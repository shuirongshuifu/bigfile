import axios from "axios";

// 文件分片函数
export function sliceFn(file, chunkSize) {
    const result = [];
    // 从第0字节开始切割，一次切割1 * 1024 * 1024字节
    for (let i = 0; i < file.size; i = i + chunkSize) {
        result.push(file.slice(i, i + chunkSize));
    }
    return result;
}

/**
 * 发请求，校验文件是否上传过，分三种情况：见：fileStatus
 * */
export function checkFileFn(fileMd5) {
    return new Promise((resolve, reject) => {
        resolve(axios.post(`http://127.0.0.1:8686/bigfile/check?fileMd5=${fileMd5}`))
    })
}

/**
 * 分片上传请求接口
 * */
export function sliceFileUploadFn(formData) {
    return new Promise((resolve, reject) => {
        resolve(axios.post("http://127.0.0.1:8686/bigfile/upload", formData))
    })
}

/**
 * 告知后端要去合并前端上传的文件了
 * */
export function tellBackendMergeFn(fileName, fileMd5) {
    return new Promise((resolve, reject) => {
        resolve(axios.post(`http://127.0.0.1:8686/bigfile/merge?fileName=${fileName}&fileMd5=${fileMd5}`))
    })
}