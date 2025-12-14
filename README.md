# Video Foreground

A demonstration of a green screen-like cutout of live video over different image backgrounds in the browser.

Uses TensorFlow.js and the BodyPix model for person segmentation.

# Local Install

1. Initialize project and install dependencies:

   npm init -y
   npm install @tensorflow/tfjs @tensorflow-models/body-pix

2. Create a vendor/ directory and copy required UMD builds there for GitHub Pages:

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
If GitHub push from this environment fails (no network or no ssh key), push from your machine where you have access.

