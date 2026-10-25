# 绯衣公子 · Live2D 动作台

纯静态网页，无需构建、无需后端，可直接部署到 GitHub Pages。

## 文件结构

```
index.html          页面
style.css           样式
app.js              逐层渲染 / 参数 / 动作 / 图层 / GIF 导出接口
parts.json          部件清单（尺寸、位置、枢轴、层级）
assets/             13 个部件贴图 + parts_sheet.png 拆解图
gifs/               6 个动作 GIF
.nojekyll           跳过 Jekyll 处理
```

## 方式一：网页上传

1. 新建一个 public 仓库（例如 `feiyi-live2d`）。
2. 进入仓库，点 **Add file → Upload files**，把本目录中的所有文件与文件夹上传到仓库**根目录**。
3. 由于网页上传可能漏掉隐藏文件，请用 **Add file → Create new file** 新建一个空文件，文件名填 `.nojekyll`，提交即可。
4. 打开 **Settings → Pages**，Source 选择 **Deploy from a branch**，分支选 `main`、目录选 `/ (root)`，保存。
5. 等待约 1 分钟，访问：

```
https://<你的用户名>.github.io/<仓库名>/
```

## 方式二：命令行

```bash
cd live2d-pages

git init
git add -A
git commit -m "feat: 绯衣公子 Live2D 动作台"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

使用 SSH 时把地址换成 `git@github.com:<你的用户名>/<仓库名>.git`。

推送完成后，同样在 **Settings → Pages** 中选择 `main` / `/ (root)` 并保存。

## 更新与说明

- 修改文件后 `git add -A && git commit -m "update" && git push`，Pages 会自动重新构建。
- 首屏约 12 MB（其中 6 个 GIF 共 7.3 MB），加载会稍慢；如需更快可压缩 GIF 或改为点击后加载。
- 站点使用相对路径，放在仓库根目录即可访问；若想放到子目录，Pages 需选择对应目录（或改用 Actions 发布）。
- GitHub 对仓库有 1 GB 建议上限、单文件 100 MB 限制，本项目远低于限制。
- 自定义域名可在 **Settings → Pages → Custom domain** 中配置。
