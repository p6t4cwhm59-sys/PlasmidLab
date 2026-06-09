PlasmidLab PWA 正式版 v2.1.8

文件说明：
- index.html：PlasmidLab 主程序，已加入 PWA 支持。
- manifest.json：iPhone/iPad 添加到主屏幕所需配置。
- sw.js：离线缓存脚本。
- icon-192.png / icon-512.png：桌面图标。

GitHub Pages 上传步骤：
1. 解压本 zip。
2. 进入 GitHub 仓库 PlasmidLab。
3. 删除旧的 index.html、manifest.json、sw.js、icon-192.png、icon-512.png。
4. 上传本文件夹内全部文件。
5. Commit changes。
6. 等待 GitHub Pages 自动刷新 1-3 分钟。
7. 打开 https://你的用户名.github.io/PlasmidLab/
8. iPhone/iPad 点击分享按钮 → 添加到主屏幕 → 保持“作为网页 App 打开”开启 → 添加。

注意：
- PWA 第一次打开需要联网；成功打开一次后，后续可离线缓存运行。
- 如果更新后页面仍旧显示旧版本，关闭桌面图标重新打开，或在浏览器中刷新几次。
- GBK 可用 SnapGene 打开，再另存为 .dna。
