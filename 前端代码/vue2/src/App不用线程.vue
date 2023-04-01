<template>
  <div id="app">
    <br />
    <input ref="inputRef" class="inputFile" type="file" @change="changeFile" />
    <br />
    <br />
    <div>大文件分了{{ chunksCount }}片:</div>
    <br />
    <div class="pieceItem" v-for="index in chunksCount" :key="index">
      {{ index - 1 }}
    </div>
    <br />
    <br />
    <div>计算此大文件的hash值进度</div>
    <div class="r">结果为: {{ fileHash }}</div>
    <progress max="100" :value="hashProgress"></progress> {{ hashProgress }}%
    <br />
    <br />
    <div>
      <div>上传文件的进度</div>
      <div class="r" v-show="fileProgress == 100">上传成功</div>
      <progress max="100" :value="fileProgress"></progress> {{ fileProgress }}%
    </div>
    <br />
    <br />
    <br />
  </div>
</template>

<script>
import {
  sliceFn,
  calFileMd5Fn,
  checkFileFn,
  sliceFileUploadFn,
  tellBackendMergeFn,
} from "./utils/index.js";
// 定义文件上传状态码
const fileStatus = {
  0: "文件不存在（没有上传过）",
  1: "文件已存在（曾经上传过）",
  2: "文件不完整（曾经上传中断过，可继续上传）",
};
export default {
  name: "App",
  data() {
    return {
      CHUNK_SIZE: 1 * 1024 * 1024, // 文件分片大小
      hashProgress: 0, // 计算hash值进度
      chunksCount: 0, // 一共分了多少片
      fileHash: "", // 大文件的hash值
      doneFileList: [], // 部分已完成的
      fileProgress: 0, // 上传文件的进度
    };
  },
  methods: {
    // hash进度条
    progressCallbackFn(val) {
      this.hashProgress = val;
    },
    /**
     * 第一步，获取文件并分片，根据分片结果算出文件的hash值，与此同时，更改文件解析的hash进度条
     * */
    async changeFile(e) {
      let file = this.$refs.inputRef.files[0]; // 获取文件
      const chunks = sliceFn(file, this.CHUNK_SIZE); // 文件分片
      this.chunksCount = chunks.length; // 文件分了多少片
      // 计算文件hash值
      const fileMd5 = await calFileMd5Fn(chunks, this.progressCallbackFn);
      this.fileHash = fileMd5; // 存一份hash值
      this.hashProgress = 100; // 计算完了，进度就为100%了
      this.uploadFileCheck(fileMd5, chunks, file.name); // 然后执行文件检查操作
    },
    /**
     * 第二步，上传文件前的检查
     * */
    async uploadFileCheck(fileMd5, chunks, fileName) {
      // 根据文件的hash值进行上传之前的校验，校验结果如下三种情况
      const res = await checkFileFn(fileMd5);
      // 等于1曾经上传过，不需要再上传了
      if (res.data.resultCode == 1) {
        this.$message({
          type: "warning",
          message: fileStatus[res.data.resultCode],
        });
        return; // 拦截停下
      }
      // 等于2表示曾经上传过一部分，现在要继续上传
      if (res.data.resultCode == 2) {
        // 若是文件曾上传过一部分，后端会返回上传过得部分的文件索引，前端通过索引可以知道哪些
        // 上传过，做一个过滤，已上传的文件就不用继续上传了，上传未上传过的文件片
        this.doneFileList = res.data.resultData.map((item) => {
          return item * 1; // 后端给到的是字符串索引，这里转成数字索引
        });
        console.log(fileStatus[res.data.resultCode]);
      }
      // 等于0表示没有上传过，直接上传
      if (res.data.resultCode == 0) {
        console.log(fileStatus[res.data.resultCode]);
      }

      let formDataList = []; // 准备参数数组

      // 说明没有上传过，组装一下，直接使用
      if (this.doneFileList.length == 0) {
        formDataList = chunks.map((item, index) => {
          // 后端接参大致有：文件片、文件分的片数、每次上传是第几片(索引)、文件名、此完整大文件hash值
          // 具体后端定义的参数prop属性名，看他们如何定义的，这个无妨...
          let formData = new FormData();
          formData.append("file", item); // 使用FormData可以将blob文件转成二进制binary
          formData.append("chunks", chunks.length);
          formData.append("chunk", index);
          formData.append("name", fileName);
          formData.append("md5", fileMd5);
          return { formData };
        });
      }
      // 说明曾经上传过，需要过滤一下，曾经上传过的就不用再上传了
      else {
        formDataList = chunks
          .filter((index) => {
            return !this.doneFileList.includes(index);
          })
          .map((item, index) => {
            let formData = new FormData();
            formData.append("file", item); // 使用FormData可以将blob文件转成二进制binary
            formData.append("chunks", chunks.length);
            formData.append("chunk", index);
            formData.append("name", fileName);
            formData.append("md5", fileMd5);
            return { formData };
          });
      }
      this.fileUpload(formDataList, fileName);
    },
    /**
     * 第三步，上传文件（分片上传，一片文件就是一个请求）
     * */
    async fileUpload(formDataList, fileName) {
      const requestListFn = formDataList.map(async ({ formData }, index) => {
        const res = await sliceFileUploadFn(formData);
        // 每上传完毕一片文件，后端告知已上传了多少片，除以总片数，就是进度
        this.fileProgress = Math.ceil(
          (res.data.resultData / this.chunksCount) * 100
        );
        return res;
      });
      // 使用allSettled发请求好一些，挂了的就挂了，不影响后续不挂的请求
      Promise.allSettled(requestListFn).then(async (many) => {
        // 都上传完毕了，文件上传进度条就为100%了
        this.fileProgress = 100;
        // 最后再告知后端合并一下已经上传的文件碎片了即可
        const res = await tellBackendMergeFn(fileName, this.fileHash);
        if (res.data.resultCode === 0) {
          console.log("文件并合成功");
        }
      });
    },
  },
};
</script>

<style>
.pieceItem {
  width: 36px;
  height: 36px;
  text-align: center;
  line-height: 36px;
  border: 1px solid #999;
  display: inline-block;
}
progress {
  width: 60%;
}
.r {
  font-size: 13px;
  font-weight: 700;
}
</style>
