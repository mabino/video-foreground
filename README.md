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


Sample per-scene filters
------------------------
This project demonstrates how to apply CSS filters to the overlaid video on a per-background basis using simple selectors. The demo uses the following filters (see styles.css):

- scene01: grayscale(100%) — black & white effect
- scene02: sepia(60%) saturate(120%) — warm vintage tone with increased saturation
- scene03: contrast(120%) — stronger contrast
- scene04: unchanged (no filter)

Example CSS (from styles.css):

.demo:nth-of-type(1) .alphaCanvas { filter: grayscale(100%); }
.demo:nth-of-type(2) .alphaCanvas { filter: sepia(60%) saturate(120%); }
.demo:nth-of-type(3) .alphaCanvas { filter: contrast(120%); }
/* scene 4: no filter */

These filters are purely cosmetic and applied via CSS to the canvas element that contains the processed video. Modify or add additional CSS filters to experiment with other looks.

Document added on: 2025-12-14T18:37:17.613Z
