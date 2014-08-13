function ByteArray(length) {
  this.byteArray = new Uint8Array(length || 1);
  this.currentIndex = 0;
  this.size = length || 1;
  this.resizeByteArray = function(delta) {
    this.size += delta;
    this.tempByteArray = this.byteArray;
    this.byteArray = new Uint8Array(this.size);
    this.byteArray.set(this.tempByteArray);
    delete this.tempByteArray;
  };
}

ByteArray.prototype.writeUnsignedByte = function(val) {
  this.writeUnsignedBytes([val]);
};

ByteArray.prototype.writeUnsignedBytes = function(arr) {
  var newSize = this.currentIndex + arr.length;
  // If it's an array adjust the index for future use.
  if (newSize > 0) {
    this.resizeByteArray(newSize - this.size);
  }

  // Write the unsigned bytes.
  this.byteArray.set(arr, this.currentIndex);
  this.currentIndex = this.size;
};

ByteArray.prototype.writeASCIIBytes = function(arr) {
  // Split every character in arr into an array and map
  // each character to its char code.
  this.writeUnsignedBytes(arr.split("").map(function(val) {
    return val.charCodeAt(0);
  }));
};

ByteArray.prototype.writeUnsignedShort = function(val) {
  // Store the unsigned short (16 bits) as 2 bytes each.
  this.writeUnsignedBytes([val, val >> 8]);
};

ByteArray.prototype.writeRGBBytes = function(r, g, b) {
  // Take RGB and stash it into 3 bytes.
  this.writeUnsignedBytes([r << 16, g << 8, b]);
};

ByteArray.prototype.getBufferData = function() {
  var chr = {},
      v = "";

  for (var i = 0; i < 256; i++) {
    chr[i] = String.fromCharCode(i);
  }

  for (var len = this.byteArray.length, j = 0; j < len; j++) {
    v += chr[this.byteArray[j]];
  }

  return v;
};

ByteArray.prototype.getBuffer = function() {
  return this.byteArray;
};

module.exports = ByteArray;
