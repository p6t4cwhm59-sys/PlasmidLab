PlasmidLab PWA 正式修正版

上传方法：
1. 解压本 zip。
2. 在 GitHub 仓库点击 Add file -> Upload files。
3. 上传解压后的全部文件，覆盖旧文件。
4. Commit changes。
5. 等 1-3 分钟后打开 GitHub Pages 地址。

本版修复点：
- 不再把 JavaScript 代码暴露到页面里。
- index.html 保留完整 PlasmidLab 主程序。
- PWA metadata 和 service worker 只插入到真正的 HTML 结尾，不破坏原程序内部字符串。
