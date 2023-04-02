# 大文件上传方案

前后端都有，用vscode和idea跑起来就能用

- 前端vue
  - 文件分片
  - 开一个辅助线程进行文件hash计算
  - Promise.allSettled请求接口
  - ...
- 后端spring
  - 校验接口
  - 上传接口
  - 合并接口
  - ...
  
未完待续...

