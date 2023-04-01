// 引入包
import SparkMD5 from "spark-md5"
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
 * 计算文件的md5值的函数
 *      chunks是blob数组，提前切割好备用 例：[Blob, ... , Blob]
 *      progressCallbackFn进度回调函数
 * */
export function calFileMd5Fn(chunks, progressCallbackFn) {
    return new Promise((resolve, reject) => {
        // 准备从第0块开始读
        let currentChunk = 0
        // 实例化SparkMD5用于计算文件hash值
        let spark = new SparkMD5.ArrayBuffer()
        // 实例化文件阅读器用于读取blob二进制文件
        let fileReader = new FileReader()
        // 兜一下错
        fileReader.onerror = reject
        // 文件读取器的onload方法表示读取完成，只要读取就会触发
        fileReader.onload = (e) => {
            progressCallbackFn(Math.ceil(currentChunk / chunks.length * 100)) // 抛出一个函数，用于告知进度
            spark.append(e.target.result) // 将二进制文件追加到spark中（官方方法）
            currentChunk = currentChunk + 1 // 这个读完就加1，读取下一个blob
            // 若未读取到最后一块，就继续读取；否则读取完成，Promise带出结果
            if (currentChunk < chunks.length) {
                fileReader.readAsArrayBuffer(chunks[currentChunk])
            } else {
                resolve(spark.end()) // resolve出去告知结果
            }
        }
        // 文件读取器的readAsArrayBuffer方法开始读取文件，从blob数组中的第0项开始
        fileReader.readAsArrayBuffer(chunks[currentChunk])
    })
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

