PlasmidLab PWA 使用说明

文件说明：
- index.html：PlasmidLab 主程序
- manifest.json：PWA 安装配置
- sw.js：离线缓存脚本
- icon-192.png / icon-512.png：手机桌面图标

部署到 GitHub Pages：
1. 新建 GitHub 仓库，例如 PlasmidLab。
2. 上传本文件夹内所有文件到仓库根目录。
3. 打开仓库 Settings → Pages。
4. Source 选择 Deploy from a branch，Branch 选择 main / root。
5. 等待生成网址，例如 https://你的用户名.github.io/PlasmidLab/

安装到 iPhone：
1. 用 Safari 打开上面的网址。
2. 点击分享按钮。
3. 选择“添加到主屏幕”。
4. 桌面会出现 PlasmidLab 图标。

注意：
- PWA 必须通过 http/https 访问，直接打开本地 file:// 文件不能完整启用离线缓存。
- 更新新版后，如果手机仍显示旧版，可在 Safari 清除网站数据，或修改 sw.js 里的 CACHE_NAME。
