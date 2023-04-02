<template>
  <div id="app">
    <br />
    <input ref="inputRef" class="inputFile" type="file" @change="changeFile" />
    <br />
    <br />
    <div>大文件 <span class="bigFileC">📁</span> 分了{{ chunksCount }}片:</div>
    <br />
    <div class="pieceItem" v-for="index in chunksCount" :key="index">
      <span class="a">{{ index - 1 }}</span>
      <span class="b">📄</span>
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
      <div class="r" v-show="fileProgress == 100">文件上传完成</div>
      <progress max="100" :value="fileProgress"></progress> {{ fileProgress }}%
    </div>
    <br />
    <br />
    <br />
  </div>
</template>

<script setup>
import { ref } from "vue";
import { ElMessage, ElLoading } from "element-plus";

import {
  sliceFn,
  checkFileFn,
  sliceFileUploadFn,
  tellBackendMergeFn,
} from "./utils/index.js";

const fileStatus = {
  0: "文件不存在（没有上传过）",
  1: "文件已存在（曾经上传过）",
  2: "文件不完整（曾经上传中断过，可继续上传）",
};

const CHUNK_SIZE = 5 * 1024 * 1024;
let hashProgress = ref(0);
let chunksCount = ref(0);
let fileHash = ref("");
let fileProgress = ref(0);
let worker = ref();

const inputRef = ref(); // 输入框dom

let doneFileList = []; // 曾经上传过得文件
let formDataList = []; // 准备参数数组

// 开辅助线程计算大文件hash值
const calFileMd5ByThreadFn = (chunks) => {
  return new Promise((resolve) => {
    worker = new Worker("./hash.js"); // 实例化一个webworker线程
    worker.postMessage({ chunks }); // 主线程向辅助线程传递数据，发分片数组用于计算
    worker.onmessage = (e) => {
      const { hash } = e.data; // 辅助线程将相关计算数据发给主线程
      hashProgress.value = e.data.hashProgress; // 更改进度条
      if (hash) {
        // 当hash值被算出来时，就可以关闭主线程了
        worker.terminate();
        resolve(hash); // 将结果带出去
      }
    };
  });
};

/**
 * 第一步，上传文件
 * */
const changeFile = async () => {
  let file = inputRef.value.files[0]; // 获取文件
  const chunks = sliceFn(file, CHUNK_SIZE); // 文件分片
  chunksCount.value = chunks.length;
  const fileMd5 = await calFileMd5ByThreadFn(chunks); // 根据分片计算
  fileHash.value = fileMd5;
  uploadFileCheck(fileMd5, chunks, file.name);
};

/**
 * 第二步，上传文件前的检查
 * */
const uploadFileCheck = async (fileMd5, chunks, fileName) => {
  // 根据文件的hash值进行上传之前的校验，校验结果如下三种情况
  const res = await checkFileFn(fileMd5);
  // 等于1曾经上传过，不需要再上传了
  if (res.data.resultCode == 1) {
    ElMessage({
      type: "warning",
      message: fileStatus[res.data.resultCode],
    });
    return;
  }
  // 等于2表示曾经上传过一部分，现在要继续上传
  if (res.data.resultCode == 2) {
    // 若是文件曾上传过一部分，后端会返回上传过得部分的文件索引，前端通过索引可以知道哪些
    // 上传过，做一个过滤，已上传的文件就不用继续上传了，上传未上传过的文件片
    doneFileList = res.data.resultData.map((item) => {
      return item * 1; // 后端给到的是字符串索引，这里转成数字索引
    });
    console.log(fileStatus[res.data.resultCode]);
  }
  // 等于0表示没有上传过，直接上传
  if (res.data.resultCode == 0) {
    console.log(fileStatus[res.data.resultCode]);
  }

  // 说明没有上传过，组装一下，直接使用
  if (doneFileList.length == 0) {
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
        return !doneFileList.includes(index);
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
  fileUpload(formDataList, fileName);
};
/**
 * 第三步，上传文件（分片上传，一片文件就是一个请求）
 * */
const fileUpload = (formDataList, fileName) => {
  const requestListFn = formDataList.map(async ({ formData }, index) => {
    const res = await sliceFileUploadFn(formData);
    // 每上传完毕一片文件，后端告知已上传了多少片，除以总片数，就是进度
    fileProgress.value = Math.ceil(
      (res.data.resultData / chunksCount.value) * 100
    );
    return res;
  });
  // 使用allSettled发请求好一些，挂了的就挂了，不影响后续不挂的请求
  Promise.allSettled(requestListFn).then(async (many) => {
    // 都上传完毕了，文件上传进度条就为100%了
    fileProgress.value = 100;
    // 最后再告知后端合并一下已经上传的文件碎片了即可
    const loading = ElLoading.service({
      lock: true,
      text: "文件合并中，请稍后📄📄📄...",
      background: "rgba(0, 0, 0, 0.7)",
    });
    const res = await tellBackendMergeFn(fileName, fileHash.value);
    if (res.data.resultCode === 0) {
      console.log("文件并合成功,大文件上传任务完成");
      loading.close();
    } else {
      console.log("文件并合失败,大文件上传任务未完成");
      loading.close();
    }
  });
};
</script>

<style scoped>
#app {
  background-color: #ccc;
  box-sizing: border-box;
  padding: 12px;
  width: 100%;
  height: 100vh;
  overflow-y: auto;
}
.bigFileC {
  font-size: 48px;
}
.pieceItem {
  width: 36px;
  height: 36px;
  display: inline-block;
  position: relative;
}
.a,
.b {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
.a {
  z-index: 6;
  font-weight: bold;
  font-size: 13px;
}
.b {
  z-index: 5;
  font-size: 32px;
}
progress {
  width: 60%;
}
.r {
  font-size: 13px;
  font-weight: 700;
}
</style>
