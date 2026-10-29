# Preview this branch locally

Pull request 237 is the launch post (Chinese and English). It is not on the public site. Check the branch out and serve the `site/` directory. The server only reads files under `site/` and does not start the game.

You need access to the private repository `SihanXU/openworld`, the GitHub CLI logged in, and Node.js 18 or newer (`node --version`).

From an empty directory:

```bash
gh repo clone SihanXU/openworld
cd openworld
gh pr checkout 237
node site/tools/serve.mjs site 8767
```

If the repository is already cloned, the last two lines are enough. Stop the server with Ctrl+C.

Open these on the same machine:

- Chinese post: http://127.0.0.1:8767/news/launch/zh.html
- English post: http://127.0.0.1:8767/news/launch/
- Project page: http://127.0.0.1:8767/

`site/media/hero.mp4` and `hero.jpg` are generated and are not in the repository. Those two requests 404. The page still loads; the hero area uses a still from the camp clip.

Checking out the pull request downloads the whole private repository, not only the post. The browser URLs above are the pages to read.
