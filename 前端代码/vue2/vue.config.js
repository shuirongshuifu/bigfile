
module.exports = {
    // 关闭eslint校验.
    devServer: {
        overlay: {
            warnings: false, //不显示警告
            errors: false	//不显示错误
        }
    },
    lintOnSave: false //关闭eslint检查
}

