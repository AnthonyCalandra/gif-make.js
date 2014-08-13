function GIF(width, height, defaultDelay, imageQuality) {
  this.byteArray = new ByteArray();
  this.width = width;
  this.height = height;
  this.defaultDelay = defaultDelay || 1000;
  this.imageQuality = imageQuality || 10;
  this.numFrames = 0;

  // Logical Screen Descriptor
  this.writeLSD = function() {
    // Canvas width and height.
    this.byteArray.writeUnsignedShort(this.width);
    this.byteArray.writeUnsignedShort(this.height);
    // Packed byte: Global color table set, 8 bits/pixel, no sort, 2^8 table size.
    this.byteArray.writeUnsignedByte(0x80 | 0x70 | 7);
    // Background color index.
    this.byteArray.writeUnsignedByte(0);
    // Pixel-aspect ratio.
    this.byteArray.writeUnsignedByte(0);
  };

  this.writeGraphicsControlExtension = function(delay) {
    // Indicates the GCE.
    this.byteArray.writeUnsignedByte(0x21);
    this.byteArray.writeUnsignedByte(0xF9);
    // Block size (always 0x04).
    this.byteArray.writeUnsignedByte(4);
    // Packed byte: reserved, no disposal, no user input, no transparency.
    this.byteArray.writeUnsignedByte(0);
    // Delay time is set as one-hundredths of a second.
    this.byteArray.writeUnsignedShort(Math.round(delay / 10));
    // Transparent color.
    this.byteArray.writeUnsignedByte(0);
    this.byteArray.writeUnsignedByte(0);
  };

  this.writeLocalImageDescriptor = function() {
    // Image seperator.
    this.byteArray.writeUnsignedByte(0x2C);
    // Image starts at (0,0) on GIF canvas.
    this.byteArray.writeUnsignedShort(0);
    this.byteArray.writeUnsignedShort(0);
    // Image width and height (by default is the size of canvas).
    this.byteArray.writeUnsignedShort(this.width);
    this.byteArray.writeUnsignedShort(this.height);
    // Local color table is set only for frames other tha the first. First
    // frame uses the global color table.
    if (this.numFrames > 0) {
      // Packed byte: local color table, interlace(?), no sort, reserved,
      // table is 2^8, in size.
      this.byteArray.writeUnsignedByte(0x80 | 7);
    } else {
      this.byteArray.writeUnsignedByte(0);
    }
  };

  this.setLocalColorTable = function(colorPalette) {
    // Write every color to the bytearray.
    this.byteArray.writeUnsignedBytes(colorPalette);
    // Each color table entry requires 3 bytes, so check how many
    // empty entries are left.
    var remainingTableSpace = (3 * 256) - colorPalette.length;
    if (remainingTableSpace > 0) {
      // Fill the rest of the table with black pixels.
      for (var index = 0; index < remainingTableSpace; index++) {
        this.byteArray.writeUnsignedByte(0);
      }
    }
  };

  this.writeImageData = function(indexedPixels) {
    // GIF writes image data using LZW compression.
    var lzw = new LZWEncoder(this.width, this.height, indexedPixels, 8);
    lzw.encode(this.byteArray);
  };

  this.writeNetscapeExtension = function() {
    // Application extension bytes.
    this.byteArray.writeUnsignedByte(0x21);
    this.byteArray.writeUnsignedByte(0xFF);
    this.byteArray.writeUnsignedByte(0x0B);
    // App id.
    this.byteArray.writeASCIIBytes("NETSCAPE2.0");
    this.byteArray.writeUnsignedByte(3);
    this.byteArray.writeUnsignedByte(1);
    // Number of iterations to make (0 = forever).
    this.byteArray.writeUnsignedShort(0);
    this.byteArray.writeUnsignedByte(0);
  };
}

GIF.prototype.start = function() {
  // Header.
  this.byteArray.writeASCIIBytes("GIF89a");
};

GIF.prototype.finish = function() {
  // Trailer.
  this.byteArray.writeUnsignedByte(0x3B);
};

GIF.prototype.setDelay = function(ms) {
  this.defaultDelay = ms;
};

GIF.prototype.addFrame = function(imageContext, delay) {
  var imageData, imagePixels;
  // Is it an HTML5 canvas context?
  if (imageContext.toString() === "[object CanvasRenderingContext2D]") {
    imageData = imageContext.getImageData(0, 0, imageContext.canvas.width,
      imageContext.canvas.height).data;
    imagePixels = (function() {
      // The pixel array returned from canvas context includes alpha.
      var rgbaPixels = imageData,
          rgbPixels = [],
          rgbPixelsIndex = 0;

      // Strip out the alpha values and store RGB values in a new array.
      for (var index = 0; index < rgbaPixels.length; index += 4) {
        // Extract only the RGB values from the RGBA image data.
        rgbPixels[rgbPixelsIndex++] = rgbaPixels[index];
        rgbPixels[rgbPixelsIndex++] = rgbaPixels[index + 1];
        rgbPixels[rgbPixelsIndex++] = rgbaPixels[index + 2];
      }

      return rgbPixels;
    })();
  } else {
    // Assume it's an RGB array or buffer of pixels.
    imagePixels = imageContext;
  }

  var nq = new NeuQuant(imagePixels, imagePixels.length, this.imageQuality),
      colorPalette = nq.process();

  // The first frame.
  if (this.numFrames == 0) {
    this.writeLSD();
    // Is actually global color table.
    this.setLocalColorTable(colorPalette);
    // Allows the GIF to repeat indefinitely.
    this.writeNetscapeExtension();
  }

  // Split RGB array into individual pixels.
  var numPixels = imagePixels.length / 3,
      k = 0,
      indexedPixels = [];

  for (var pixelIndex = 0; pixelIndex < numPixels; pixelIndex++) {
    // Store RGB values in quantizer.
    var index = nq.map(imagePixels[k++] & 0xFF,
      imagePixels[k++] & 0xFF, imagePixels[k++] & 0xFF);

    indexedPixels[pixelIndex] = index;
  }

  this.writeGraphicsControlExtension(delay || this.defaultDelay);
  this.writeLocalImageDescriptor();
  // Frames other than the first use the local color table.
  if (this.numFrames > 0) {
    this.setLocalColorTable(colorPalette);
  }

  // Write the image data to the GIF.
  this.writeImageData(indexedPixels);
  this.numFrames++;
};

GIF.prototype.toDataURI = function() {
  if (inNode) {
    return "data:image/gif;base64," + new Buffer(this.byteArray.getBufferData(), "base64");
  } else {
    return "data:image/gif;base64," + window.btoa(this.byteArray.getBufferData());
  }
};

GIF.prototype.saveToFile = function(name, cb, path) {
  // TODO: browsers.
  if (!inNode) {
    return false;
  }

  var buffer = new Buffer(this.byteArray.getBuffer()),
      path = path || "",
      wstream = fs.createWriteStream(path + name + ".gif");

  wstream.write(buffer);
  wstream.end(cb);
  return true;
};

var NeuQuant = require("./neuquant.js"),
    LZWEncoder = require("./lzw-encoder.js"),
    ByteArray = require("./bytearray.js"),
    inNode = typeof window === "undefined";

if (!inNode) {
  window.GIF = GIF;
} else {
  var fs = require("fs");
  module.exports = GIF;
}
