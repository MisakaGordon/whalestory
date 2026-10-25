# whalestory
将 DeepSeek Harness 的运行状态变成肥鱼讲故事。在聊天输入框上方显示大肥鱼，根据当前会话的工具调用、流式思维链/回答、错误和待回答状态切换图片并说一句短台词。

## 安装
在插件管理页面添加 
```
@gordon2moon/dsh-whalestory
```
- 安装后将当前 GUI 页面刷新一次；插件会跨会话、跨重启保留，可在插件页停用。

## 特点
- 台词的本地台词库总是立即生成；符合节拍且冷却已过时，才请求一次独立旁白模型。LLM 调用不携带 SessionId、不共享主会话上下文、不使用工具，主会话的消息历史和请求前缀不受影响。
- 旁白 LLM 频率可在 **Settings → General → 旁白 LLM 频率** 切换：关闭 / 低频率 / 高频率 / 总是使用 LLM；选择保存在当前浏览器，切换后即时生效。
- **内容感知深度**也在 Settings → General：关闭 / 摘要 / 片段，默认关闭。摘要只发送本地统计（文件、语言、行数、命令退出码）；片段额外发送最多 600 字的脱敏摘录，且只来自当前已加载会话里已读取的内容。调整为摘要或片段时会显示用量与隐私警告。
- **旁白 LLM 用量**在 Settings → General：显示本次 Host 运行的调用、成功、空回复、错误、限流和输入/输出 token；重启后清零，只统计计数和 token，不记录提示词或内容。
- 不做不可靠或读不到的事：不独立读磁盘、不读 git diff、不扫描未加载历史、不识别图片像素。`edit`/`write` 的摘要和片段只来自工具参数中已有的内容。
- 频率策略：关闭不调用；低频率 45 秒冷却；高频率 15 秒冷却；总是使用 LLM 4 秒冷却，并连空闲台词也尝试旁白。服务端仍按模式限流：低 30 次/小时、高 80 次/小时、总是 120 次/小时，每 10 分钟另有会话上限，全局并发 1、6 秒超时、最多 96 输出 token，并优先关闭 reasoning。
- 图片显示严格按 `img/picture_ref.md`：普通、错误、询问、写作、双帧行走，以及叠加在角色右上方的气泡。
- 高提问/审批面板会替换整个输入框区域；此时角色切到右上角的小号“探头”模式，避免被高面板挤出视野，回答完自动回到输入框上方。
- 气泡不会闪一下就被覆盖：每个气泡至少停留约 2.8 秒；LLM 台词会先等本地台词显示约 1.2 秒再替换，快速连续的节拍会排队显示最新一条。
- 气泡文字超过 20 字自动降到 12px，超过 28 字降到 10px 并允许 3 行，避免长台词被裁切。
- 美术原图保留在 `img/`；`plugin/assets/` 中是从原图派生的透明 WebP，可由 `scripts/build-whalestory-assets.sh` 重新生成。
- 人设写作规范在 `.dsh/skills/da-feiyu/SKILL.md`，原始人设与语料仍在 `references/`。

### 验证

```bash
node --test plugin/test/client.test.mjs plugin/test/narrate.test.mjs plugin/test/usage.test.mjs
node --check plugin/index.js
node --check plugin/narrate.js
node --check plugin/client.js
```
### 版权信息
制作图片时使用了 https://github.com/TreapGoGo/deepseek-whale-girl 中的提示词，本项目中图片也使用CC BY-SA 4.0
人设语料来自 https://github.com/ERUIHNIYHBKBNF/dafeiyu-persona/ ，使用MIT协议。