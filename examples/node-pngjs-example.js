
function addPNGFrame(imageName) {
  fs.createReadStream(imageName)
      .pipe(new PNG({
          filterType: 4
      }))
      .on("parsed", function() {
        var rgbPixels = [],
            rgbPixelsIndex = 0;

        for (var y = 0; y < this.height; y++) {
          for (var x = 0; x < this.width; x++) {
            var idx = (this.width * y + x) << 2;
            // RGB only.
            rgbPixels[rgbPixelsIndex++] = this.data[idx];
            rgbPixels[rgbPixelsIndex++] = this.data[idx + 1];
            rgbPixels[rgbPixelsIndex++] = this.data[idx + 2];
          }
        }

        gif.addFrame(rgbPixels);
        numFrames++;
      });
}

var fs = require("fs"),
    PNG = require("pngjs").PNG,
    GIF = require("../src/gif-make.js"),
    gif  = new GIF(420, 420),
    numFrames = 0;

gif.start();
addPNGFrame("1.png");
addPNGFrame("2.png");
var deferImagesInterval = setInterval(function() {
  // Wait until all frames are loaded.
  if (numFrames < 2) {
    return;
  }

  clearInterval(deferImagesInterval);
  gif.finish();
  gif.saveToFile("wat", function() {
    console.log("GIF saved!");
  });
}, 10);
