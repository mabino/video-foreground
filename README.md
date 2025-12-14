# Video Foreground

A demonstration of a green screen-like cutout of live video over different image backgrounds in the browser.

Uses TensorFlow.js and the BodyPix model for person segmentation.

Recommended local install (node/npm):

1. Initialize project and install dependencies:

   npm init -y
   npm install @tensorflow/tfjs @tensorflow-models/body-pix

2. Create a vendor/ directory and copy required UMD builds there for GitHub Pages:

   # create vendor and copy files
   mkdir -p vendor
   cp node_modules/@tensorflow/tfjs/dist/tf.min.js vendor/
   cp node_modules/@tensorflow-models/body-pix/dist/body-pix.min.js vendor/

3. Update index.html to include the local vendor files instead of the CDN (example):

   <!-- local vendor -->
   <script src="vendor/tf.min.js"></script>
   <script src="vendor/body-pix.min.js"></script>

If you prefer using CDNs (jsdelivr/unpkg), uncomment the CDN <script> lines in index.html. The repository currently comments them out to encourage local installation.

Running locally
---------------
Serve the directory (required because camera access and some browsers restrict file://):

   python3 -m http.server
   # then open http://localhost:8000

GitHub Pages with conditional dependency handling
-----------------------------------------------
If you want to publish a demo via GitHub Pages but don't want to install node deps on the CI runner, a simple workflow approach is:

- Try to install node deps and copy vendor files into the repository's build output.
- If installation fails (or you choose not to install), leave the CDN lines enabled instead.

Sample GitHub Actions workflow (place in .github/workflows/deploy.yml):

```yaml
name: Deploy demo
on:
  push:
    branches: [ master, main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Try install dependencies
        id: deps
        run: |
          set -e
          npm ci || echo "INSTALL_FAILED" > install_failed

      - name: Copy vendor if installed
        if: ${{ !exists('install_failed') }}
        run: |
          mkdir -p vendor
          cp node_modules/@tensorflow/tfjs/dist/tf.min.js vendor/
          cp node_modules/@tensorflow-models/body-pix/dist/body-pix.min.js vendor/

      - name: Build site (noop)
        run: echo "No build step; ensuring index.html references vendor if present"

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./
```

Notes:
- The workflow attempts npm ci; if successful it copies vendor files and the index.html can include those local vendor files (you can add logic to replace commented CDN lines). If npm install is skipped or fails, you can choose to enable CDN script lines (uncomment) by doing a simple sed replacement in the workflow or keep CDN lines enabled locally.

Committing and pushing
----------------------
This repo has been updated locally to comment out CDN script tags and includes this README. Commit and push to your remote (ssh key required):

   git remote add origin git@github.com:mabino/video-foreground.git
   git push -u origin main

If GitHub push from this environment fails (no network or no ssh key), push from your machine where you have access.

