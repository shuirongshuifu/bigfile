const express = require('express');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const app = express();
const cors = require('cors');

app.use(cors()); // 启用CORS中间件,允许所有跨域请求

// 配置
const FILE_STORE_PATH = path.join(__dirname, 'uploaded_files'); // 存储路径
const mergeDir = path.join(FILE_STORE_PATH, 'merge'); // 合并文件存储目录
const upload = multer({ dest: FILE_STORE_PATH }); // multer文件上传中间件

// 创建必要目录
fs.ensureDirSync(FILE_STORE_PATH);
fs.ensureDirSync(mergeDir);

// 响应格式统一处理
const successResponse = (data = {}, message = '成功') => ({ resultCode: 0, resultData: data, message });
const errorResponse = (code = -1, message = '失败') => ({ resultCode: code, message });

// 检查文件状态接口
app.post('/bigfile/check', (req, res) => {
    const fileMd5 = req.query.fileMd5;
    const mergePath = path.join(mergeDir, fileMd5);
    const chunkDir = path.join(FILE_STORE_PATH, fileMd5);

    try {
        // 检查是否完整文件已存在
        if (fs.existsSync(mergePath)) {
            return res.json(successResponse(1, '文件已存在'));
        }

        // 检查是否有分片文件
        if (fs.existsSync(chunkDir)) {
            const chunks = fs.readdirSync(chunkDir);
            return res.json(successResponse({
                resultCode: 2,
                resultData: chunks.map(c => parseInt(c)) // 返回数字索引数组
            }));
        }

        // 文件不存在，全新上传
        res.json(successResponse({ resultCode: 0, resultData: [] }));

    } catch (error) {
        console.error('检查文件错误:', error);
        res.status(500).json(errorResponse());
    }
});

// 分片上传接口
app.post('/bigfile/upload', upload.single('file'), (req, res) => {
    try {
        const { chunk, chunks, name, md5 } = req.body;
        const chunkIndex = parseInt(chunk);
        const chunkDir = path.join(FILE_STORE_PATH, md5);

        // 创建分片存储目录
        fs.ensureDirSync(chunkDir);

        // 重命名分片文件（使用索引作为文件名）
        const oldPath = req.file.path;
        const newPath = path.join(chunkDir, chunkIndex.toString());
        fs.renameSync(oldPath, newPath);

        // 获取已上传分片数量
        const uploadedChunks = fs.readdirSync(chunkDir).length;

        res.json(successResponse({
            resultCode: 0,
            resultData: uploadedChunks // 返回已上传分片数用于进度计算
        }));

    } catch (error) {
        console.error('分片上传错误:', error);
        res.status(500).json(errorResponse());
    }
});

// 合并文件接口
app.post('/bigfile/merge', async (req, res) => {
    const { fileName, fileMd5 } = req.query;
    const chunkDir = path.join(FILE_STORE_PATH, fileMd5);
    const mergeFilePath = path.join(mergeDir, fileMd5, fileName);

    try {
        // 检查分片目录是否存在
        if (!fs.existsSync(chunkDir)) {
            return res.json(errorResponse(1, '分片文件不存在'));
        }

        // 获取所有分片文件并按索引排序
        const chunkFiles = fs.readdirSync(chunkDir)
            .map(f => ({ name: f, index: parseInt(f) }))
            .sort((a, b) => a.index - b.index)
            .map(f => path.join(chunkDir, f.name));

        // 创建合并文件目录
        fs.ensureDirSync(path.dirname(mergeFilePath));

        // 创建可写流
        const writeStream = fs.createWriteStream(mergeFilePath);
        // 增加监听器上限（可选，更好的做法是优化流处理）
        // writeStream.setMaxListeners(100);

        // 使用流管道逐个合并文件
        await mergeChunksSequentially(chunkFiles, writeStream);

        // // 清理分片文件和目录
        // fs.removeSync(chunkDir);

        res.json(successResponse({ resultCode: 0 }, '文件合并成功'));

    } catch (error) {
        console.error('合并文件错误:', error);
        // 清理可能存在的不完整文件
        if (fs.existsSync(mergeFilePath)) {
            fs.removeSync(mergeFilePath);
        }
        res.status(500).json(errorResponse());
    }
});

// 顺序合并分片文件的辅助函数（避免同时添加过多监听器）
function mergeChunksSequentially(chunkFiles, writeStream) {
    return new Promise((resolve, reject) => {
        // 递归处理每个分片文件
        const processNextChunk = (index) => {
            if (index >= chunkFiles.length) {
                // 所有分片都已处理完毕
                writeStream.end();
                return resolve();
            }

            const chunkPath = chunkFiles[index];
            const readStream = fs.createReadStream(chunkPath);

            readStream.on('error', (err) => {
                reject(err);
            });

            readStream.on('end', () => {
                // 此分片处理完成，继续下一个
                processNextChunk(index + 1);
            });

            // 管道传输数据
            readStream.pipe(writeStream, { end: false });
        };

        // 开始处理第一个分片
        processNextChunk(0);

        // 监听写入完成事件
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
    });
}

// 启动服务
const PORT = 8686;
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});