(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

},{}],2:[function(require,module,exports){
(function (Buffer){
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

}).call(this,require("buffer").Buffer)
},{"./bytearray.js":1,"./lzw-encoder.js":3,"./neuquant.js":4,"buffer":6,"fs":5}],3:[function(require,module,exports){
/**
* This class handles LZW encoding
* Adapted from Jef Poskanzer's Java port by way of J. M. G. Elliott.
* @author Kevin Weiner (original Java version - kweiner@fmsware.com)
* @author Thibault Imbert (AS3 version - bytearray.org)
* @version 0.1 AS3 implementation
*/

	//import flash.utils.ByteArray;

	module.exports = function()
	{
	    var exports = {};
		/*private_static*/ var EOF/*int*/ = -1;
		/*private*/ var imgW/*int*/;
		/*private*/ var imgH/*int*/
		/*private*/ var pixAry/*ByteArray*/;
		/*private*/ var initCodeSize/*int*/;
		/*private*/ var remaining/*int*/;
		/*private*/ var curPixel/*int*/;

		// GIFCOMPR.C - GIF Image compression routines
		// Lempel-Ziv compression based on 'compress'. GIF modifications by
		// David Rowley (mgardi@watdcsu.waterloo.edu)
		// General DEFINEs

		/*private_static*/ var BITS/*int*/ = 12;
		/*private_static*/ var HSIZE/*int*/ = 5003; // 80% occupancy

		// GIF Image compression - modified 'compress'
		// Based on: compress.c - File compression ala IEEE Computer, June 1984.
		// By Authors: Spencer W. Thomas (decvax!harpo!utah-cs!utah-gr!thomas)
		// Jim McKie (decvax!mcvax!jim)
		// Steve Davies (decvax!vax135!petsd!peora!srd)
		// Ken Turkowski (decvax!decwrl!turtlevax!ken)
		// James A. Woods (decvax!ihnp4!ames!jaw)
		// Joe Orost (decvax!vax135!petsd!joe)

		/*private*/ var n_bits/*int*/ // number of bits/code
		/*private*/ var maxbits/*int*/ = BITS; // user settable max # bits/code
		/*private*/ var maxcode/*int*/ // maximum code, given n_bits
		/*private*/ var maxmaxcode/*int*/ = 1 << BITS; // should NEVER generate this code
		/*private*/ var htab/*Array*/ = new Array;
		/*private*/ var codetab/*Array*/ = new Array;
		/*private*/ var hsize/*int*/ = HSIZE; // for dynamic table sizing
		/*private*/ var free_ent/*int*/ = 0; // first unused entry

		// block compression parameters -- after all codes are used up,
		// and compression rate changes, start over.

		/*private*/ var clear_flg/*Boolean*/ = false;

		// Algorithm: use open addressing double hashing (no chaining) on the
		// prefix code / next character combination. We do a variant of Knuth's
		// algorithm D (vol. 3, sec. 6.4) along with G. Knott's relatively-prime
		// secondary probe. Here, the modular division first probe is gives way
		// to a faster exclusive-or manipulation. Also do block compression with
		// an adaptive reset, whereby the code table is cleared when the compression
		// ratio decreases, but after the table fills. The variable-length output
		// codes are re-sized at this point, and a special CLEAR code is generated
		// for the decompressor. Late addition: construct the table according to
		// file size for noticeable speed improvement on small files. Please direct
		// questions about this implementation to ames!jaw.

		/*private*/ var g_init_bits/*int*/;
		/*private*/ var ClearCode/*int*/;
		/*private*/ var EOFCode/*int*/;

		// output
		// Output the given code.
		// Inputs:
		// code: A n_bits-bit integer. If == -1, then EOF. This assumes
		// that n_bits =< wordsize - 1.
		// Outputs:
		// Outputs code to the file.
		// Assumptions:
		// Chars are 8 bits long.
		// Algorithm:
		// Maintain a BITS character long buffer (so that 8 codes will
		// fit in it exactly). Use the VAX insv instruction to insert each
		// code in turn. When the buffer fills up empty it and start over.

		/*private*/ var cur_accum/*int*/ = 0;
		/*private*/ var cur_bits/*int*/ = 0;
		/*private*/ var masks/*Array*/ = [ 0x0000, 0x0001, 0x0003, 0x0007, 0x000F, 0x001F, 0x003F, 0x007F, 0x00FF, 0x01FF, 0x03FF, 0x07FF, 0x0FFF, 0x1FFF, 0x3FFF, 0x7FFF, 0xFFFF ];

		// Number of characters so far in this 'packet'
		/*private*/ var a_count/*int*/;

		// Define the storage for the packet accumulator
		/*private*/ var accum/*ByteArray*/ = [];

		var LZWEncoder = exports.LZWEncoder = function LZWEncoder (width/*int*/, height/*int*/, pixels/*ByteArray*/, color_depth/*int*/)
		{

			imgW = width;
			imgH = height;
			pixAry = pixels;
			initCodeSize = Math.max(2, color_depth);

		}

		// Add a character to the end of the current packet, and if it is 254
		// characters, flush the packet to disk.
		var char_out = function char_out(c/*Number*/, outs/*ByteArray*/)/*void*/
		{
			accum[a_count++] = c;
			if (a_count >= 254) flush_char(outs);

		}

		// Clear out the hash table
		// table clear for block compress

		var cl_block = function cl_block(outs/*ByteArray*/)/*void*/
		{

			cl_hash(hsize);
			free_ent = ClearCode + 2;
			clear_flg = true;
			output(ClearCode, outs);

		}

		// reset code table
		var cl_hash = function cl_hash(hsize/*int*/)/*void*/
		{

			for (var i/*int*/ = 0; i < hsize; ++i) htab[i] = -1;

		}

		var compress = exports.compress = function compress(init_bits/*int*/, outs/*ByteArray*/)/*void*/

		{
			var fcode/*int*/;
			var i/*int*/ /* = 0 */;
			var c/*int*/;
			var ent/*int*/;
			var disp/*int*/;
			var hsize_reg/*int*/;
			var hshift/*int*/;

			// Set up the globals: g_init_bits - initial number of bits
			g_init_bits = init_bits;

			// Set up the necessary values
			clear_flg = false;
			n_bits = g_init_bits;
			maxcode = MAXCODE(n_bits);

			ClearCode = 1 << (init_bits - 1);
			EOFCode = ClearCode + 1;
			free_ent = ClearCode + 2;

			a_count = 0; // clear packet

			ent = nextPixel();

			hshift = 0;
			for (fcode = hsize; fcode < 65536; fcode *= 2)
			  ++hshift;
			hshift = 8 - hshift; // set hash code range bound

			hsize_reg = hsize;
			cl_hash(hsize_reg); // clear hash table

			output(ClearCode, outs);

			outer_loop: while ((c = nextPixel()) != EOF)

			{

				fcode = (c << maxbits) + ent;
				i = (c << hshift) ^ ent; // xor hashing

				if (htab[i] == fcode)
				{
				ent = codetab[i];
				continue;
				} else if (htab[i] >= 0) // non-empty slot
				{
					disp = hsize_reg - i; // secondary hash (after G. Knott)
					if (i == 0)
					disp = 1;
					do
					{

						if ((i -= disp) < 0) i += hsize_reg;

						if (htab[i] == fcode)
						{
						ent = codetab[i];
						continue outer_loop;
						}
					} while (htab[i] >= 0);
				}

				output(ent, outs);
				ent = c;
				if (free_ent < maxmaxcode)
				{
					codetab[i] = free_ent++; // code -> hashtable
					htab[i] = fcode;
				} else cl_block(outs);
			}

			// Put out the final code.
			output(ent, outs);
			output(EOFCode, outs);

		}

		// ----------------------------------------------------------------------------
		var encode = exports.encode = function encode(os/*ByteArray*/)/*void*/
		{
			os.writeUnsignedByte(initCodeSize); // write "initial code size" byte
			remaining = imgW * imgH; // reset navigation variables
			curPixel = 0;
			compress(initCodeSize + 1, os); // compress and write the pixel data
			os.writeUnsignedByte(0); // write block terminator

		}

		// Flush the packet to disk, and reset the accumulator
		var flush_char = function flush_char(outs/*ByteArray*/)/*void*/
		{

			if (a_count > 0)
			{
				outs.writeUnsignedByte(a_count);
				//outs.writeUnsignedBytes(accum, a_count);
				for (var i = 0; i < a_count; i++) {
						outs.writeUnsignedByte(accum[i]);
				}

				a_count = 0;
			}

		}

		var MAXCODE = function MAXCODE(n_bits/*int*/)/*int*/
		{

			return (1 << n_bits) - 1;

		}

		// ----------------------------------------------------------------------------
		// Return the next pixel from the image
		// ----------------------------------------------------------------------------

		var nextPixel = function nextPixel()/*int*/
		{

			if (remaining == 0) return EOF;

			--remaining;

			var pix/*Number*/ = pixAry[curPixel++];

			return pix & 0xff;

		}

		var output = function output(code/*int*/, outs/*ByteArray*/)/*void*/

		{
			cur_accum &= masks[cur_bits];

			if (cur_bits > 0) cur_accum |= (code << cur_bits);
			else cur_accum = code;

			cur_bits += n_bits;

			while (cur_bits >= 8)

			{

				char_out((cur_accum & 0xff), outs);
				cur_accum >>= 8;
				cur_bits -= 8;

			}

			// If the next entry is going to be too big for the code size,
			// then increase it, if possible.

			if (free_ent > maxcode || clear_flg)
			{

				if (clear_flg)
				{

					maxcode = MAXCODE(n_bits = g_init_bits);
					clear_flg = false;

				} else
				{

					++n_bits;

					if (n_bits == maxbits) maxcode = maxmaxcode;

					else maxcode = MAXCODE(n_bits);

				}

			}

			if (code == EOFCode)
			{

				// At EOF, write the rest of the buffer.
				while (cur_bits > 0)
				{

					char_out((cur_accum & 0xff), outs);
					cur_accum >>= 8;
					cur_bits -= 8;
				}


				flush_char(outs);

			}

		}
		LZWEncoder.apply(this, arguments);
	   return exports;
	}

},{}],4:[function(require,module,exports){
/*
* NeuQuant Neural-Net Quantization Algorithm
* ------------------------------------------
*
* Copyright (c) 1994 Anthony Dekker
*
* NEUQUANT Neural-Net quantization algorithm by Anthony Dekker, 1994. See
* "Kohonen neural networks for optimal colour quantization" in "Network:
* Computation in Neural Systems" Vol. 5 (1994) pp 351-367. for a discussion of
* the algorithm.
*
* Any party obtaining a copy of these files from the author, directly or
* indirectly, is granted, free of charge, a full and unrestricted irrevocable,
* world-wide, paid up, royalty-free, nonexclusive right and license to deal in
* this software and documentation files (the "Software"), including without
* limitation the rights to use, copy, modify, merge, publish, distribute,
* sublicense, and/or sell copies of the Software, and to permit persons who
* receive copies from any such party to do so, with the only requirement being
* that this copyright notice remain intact.
*/

/*
* This class handles Neural-Net quantization algorithm
* @author Kevin Weiner (original Java version - kweiner@fmsware.com)
* @author Thibault Imbert (AS3 version - bytearray.org)
* @version 0.1 AS3 implementation
*/

	//import flash.utils.ByteArray;

	module.exports = function()
	{
	    var exports = {};
		/*private_static*/ var netsize/*int*/ = 256; /* number of colours used */

		/* four primes near 500 - assume no image has a length so large */
		/* that it is divisible by all four primes */

		/*private_static*/ var prime1/*int*/ = 499;
		/*private_static*/ var prime2/*int*/ = 491;
		/*private_static*/ var prime3/*int*/ = 487;
		/*private_static*/ var prime4/*int*/ = 503;
		/*private_static*/ var minpicturebytes/*int*/ = (3 * prime4);

		/* minimum size for input image */
		/*
		* Program Skeleton ---------------- [select samplefac in range 1..30] [read
		* image from input file] pic = (unsigned char*) malloc(3*width*height);
		* initnet(pic,3*width*height,samplefac); learn(); unbiasnet(); [write output
		* image header, using writecolourmap(f)] inxbuild(); write output image using
		* inxsearch(b,g,r)
		*/

		/*
		* Network Definitions -------------------
		*/

		/*private_static*/ var maxnetpos/*int*/ = (netsize - 1);
		/*private_static*/ var netbiasshift/*int*/ = 4; /* bias for colour values */
		/*private_static*/ var ncycles/*int*/ = 100; /* no. of learning cycles */

		/* defs for freq and bias */
		/*private_static*/ var intbiasshift/*int*/ = 16; /* bias for fractions */
		/*private_static*/ var intbias/*int*/ = (1 << intbiasshift);
		/*private_static*/ var gammashift/*int*/ = 10; /* gamma = 1024 */
		/*private_static*/ var gamma/*int*/ = (1 << gammashift);
		/*private_static*/ var betashift/*int*/ = 10;
		/*private_static*/ var beta/*int*/ = (intbias >> betashift); /* beta = 1/1024 */
		/*private_static*/ var betagamma/*int*/ = (intbias << (gammashift - betashift));

		/* defs for decreasing radius factor */
		/*private_static*/ var initrad/*int*/ = (netsize >> 3); /*
	                                                         * for 256 cols, radius
	                                                         * starts
	                                                         */

		/*private_static*/ var radiusbiasshift/*int*/ = 6; /* at 32.0 biased by 6 bits */
		/*private_static*/ var radiusbias/*int*/ = (1 << radiusbiasshift);
		/*private_static*/ var initradius/*int*/ = (initrad * radiusbias); /*
	                                                                   * and
	                                                                   * decreases
	                                                                   * by a
	                                                                   */

		/*private_static*/ var radiusdec/*int*/ = 30; /* factor of 1/30 each cycle */

		/* defs for decreasing alpha factor */
		/*private_static*/ var alphabiasshift/*int*/ = 10; /* alpha starts at 1.0 */
		/*private_static*/ var initalpha/*int*/ = (1 << alphabiasshift);
		/*private*/ var alphadec/*int*/ /* biased by 10 bits */

		/* radbias and alpharadbias used for radpower calculation */
		/*private_static*/ var radbiasshift/*int*/ = 8;
		/*private_static*/ var radbias/*int*/ = (1 << radbiasshift);
		/*private_static*/ var alpharadbshift/*int*/ = (alphabiasshift + radbiasshift);

		/*private_static*/ var alpharadbias/*int*/ = (1 << alpharadbshift);

		/*
		* Types and Global Variables --------------------------
		*/

		/*private*/ var thepicture/*ByteArray*//* the input image itself */
		/*private*/ var lengthcount/*int*/; /* lengthcount = H*W*3 */
		/*private*/ var samplefac/*int*/; /* sampling factor 1..30 */

		// typedef int pixel[4]; /* BGRc */
		/*private*/ var network/*Array*/; /* the network itself - [netsize][4] */
		/*protected*/ var netindex/*Array*/ = new Array();

		/* for network lookup - really 256 */
		/*private*/ var bias/*Array*/ = new Array();

		/* bias and freq arrays for learning */
		/*private*/ var freq/*Array*/ = new Array();
		/*private*/ var radpower/*Array*/ = new Array();

		var NeuQuant = exports.NeuQuant = function NeuQuant(thepic/*ByteArray*/, len/*int*/, sample/*int*/)
		{

			var i/*int*/;
			var p/*Array*/;

			thepicture = thepic;
			lengthcount = len;
			samplefac = sample;

			network = new Array(netsize);

			for (i = 0; i < netsize; i++)
			{

				network[i] = new Array(4);
				p = network[i];
				p[0] = p[1] = p[2] = (i << (netbiasshift + 8)) / netsize;
				freq[i] = intbias / netsize; /* 1/netsize */
				bias[i] = 0;
			}

		}

		var colorMap = function colorMap()/*ByteArray*/
		{

			var map/*ByteArray*/ = [];
		    var index/*Array*/ = new Array(netsize);
		    for (var i/*int*/ = 0; i < netsize; i++)
		      index[network[i][3]] = i;
		    var k/*int*/ = 0;
		    for (var l/*int*/ = 0; l < netsize; l++) {
		      var j/*int*/ = index[l];
		      map[k++] = (network[j][0]);
		      map[k++] = (network[j][1]);
		      map[k++] = (network[j][2]);
		    }
		    return map;

		}

		/*
	   * Insertion sort of network and building of netindex[0..255] (to do after
	   * unbias)
	   * -------------------------------------------------------------------------------
	   */

	   var inxbuild = function inxbuild()/*void*/
	   {

		  var i/*int*/;
		  var j/*int*/;
		  var smallpos/*int*/;
		  var smallval/*int*/;
		  var p/*Array*/;
		  var q/*Array*/;
		  var previouscol/*int*/
		  var startpos/*int*/

		  previouscol = 0;
		  startpos = 0;
		  for (i = 0; i < netsize; i++)
		  {

			  p = network[i];
			  smallpos = i;
			  smallval = p[1]; /* index on g */
			  /* find smallest in i..netsize-1 */
			  for (j = i + 1; j < netsize; j++)
			  {
				  q = network[j];
				  if (q[1] < smallval)
				  { /* index on g */

					smallpos = j;
					smallval = q[1]; /* index on g */
				}
			  }

			  q = network[smallpos];
			  /* swap p (i) and q (smallpos) entries */

			  if (i != smallpos)
			  {

				  j = q[0];
				  q[0] = p[0];
				  p[0] = j;
				  j = q[1];
				  q[1] = p[1];
				  p[1] = j;
				  j = q[2];
				  q[2] = p[2];
				  p[2] = j;
				  j = q[3];
				  q[3] = p[3];
				  p[3] = j;

			  }

			  /* smallval entry is now in position i */

			  if (smallval != previouscol)

			  {

				netindex[previouscol] = (startpos + i) >> 1;

				for (j = previouscol + 1; j < smallval; j++) netindex[j] = i;

				previouscol = smallval;
				startpos = i;

			  }

			}

			netindex[previouscol] = (startpos + maxnetpos) >> 1;
			for (j = previouscol + 1; j < 256; j++) netindex[j] = maxnetpos; /* really 256 */

	   }

	   /*
	   * Main Learning Loop ------------------
	   */

	   var learn = function learn()/*void*/

	   {

		   var i/*int*/;
		   var j/*int*/;
		   var b/*int*/;
		   var g/*int*/
		   var r/*int*/;
		   var radius/*int*/;
		   var rad/*int*/;
		   var alpha/*int*/;
		   var step/*int*/;
		   var delta/*int*/;
		   var samplepixels/*int*/;
		   var p/*ByteArray*/;
		   var pix/*int*/;
		   var lim/*int*/;

		   if (lengthcount < minpicturebytes) samplefac = 1;

		   alphadec = 30 + ((samplefac - 1) / 3);
		   p = thepicture;
		   pix = 0;
		   lim = lengthcount;
		   samplepixels = lengthcount / (3 * samplefac);
		   delta = (samplepixels / ncycles) | 0;
		   alpha = initalpha;
		   radius = initradius;

		   rad = radius >> radiusbiasshift;
		   if (rad <= 1) rad = 0;

		   for (i = 0; i < rad; i++) radpower[i] = alpha * (((rad * rad - i * i) * radbias) / (rad * rad));


		   if (lengthcount < minpicturebytes) step = 3;

		   else if ((lengthcount % prime1) != 0) step = 3 * prime1;

		   else

		   {

			   if ((lengthcount % prime2) != 0) step = 3 * prime2;

			   else

			   {

				   if ((lengthcount % prime3) != 0) step = 3 * prime3;

				   else step = 3 * prime4;

			   }

		   }

		   i = 0;

		   while (i < samplepixels)

		   {

			   b = (p[pix + 0] & 0xff) << netbiasshift;
			   g = (p[pix + 1] & 0xff) << netbiasshift;
			   r = (p[pix + 2] & 0xff) << netbiasshift;
			   j = contest(b, g, r);

			   altersingle(alpha, j, b, g, r);

			   if (rad != 0) alterneigh(rad, j, b, g, r); /* alter neighbours */

			   pix += step;

			   if (pix >= lim) pix -= lengthcount;

			   i++;

			   if (delta == 0) delta = 1;

			   if (i % delta == 0)

			   {

				   alpha -= alpha / alphadec;
				   radius -= radius / radiusdec;
				   rad = radius >> radiusbiasshift;

				   if (rad <= 1) rad = 0;

				   for (j = 0; j < rad; j++) radpower[j] = alpha * (((rad * rad - j * j) * radbias) / (rad * rad));

			   }

		   }

	   }

	   /*
	   ** Search for BGR values 0..255 (after net is unbiased) and return colour
	   * index
	   * ----------------------------------------------------------------------------
	   */

	   var map = exports.map = function map(b/*int*/, g/*int*/, r/*int*/)/*int*/

	   {

		   var i/*int*/;
		   var j/*int*/;
		   var dist/*int*/
		   var a/*int*/;
		   var bestd/*int*/;
		   var p/*Array*/;
		   var best/*int*/;

		   bestd = 1000; /* biggest possible dist is 256*3 */
		   best = -1;
		   i = netindex[g]; /* index on g */
		   j = i - 1; /* start at netindex[g] and work outwards */

	    while ((i < netsize) || (j >= 0))

		{

			if (i < netsize)

			{

				p = network[i];

				dist = p[1] - g; /* inx key */

				if (dist >= bestd) i = netsize; /* stop iter */

				else

				{

					i++;

					if (dist < 0) dist = -dist;

					a = p[0] - b;

					if (a < 0) a = -a;

					dist += a;

					if (dist < bestd)

					{

						a = p[2] - r;

						if (a < 0) a = -a;

						dist += a;

						if (dist < bestd)

						{

							bestd = dist;
							best = p[3];

						}

					}

				}

			}

	      if (j >= 0)
		  {

			  p = network[j];

			  dist = g - p[1]; /* inx key - reverse dif */

			  if (dist >= bestd) j = -1; /* stop iter */

			  else
			  {

				  j--;
				  if (dist < 0) dist = -dist;
				  a = p[0] - b;
				  if (a < 0) a = -a;
				  dist += a;

				  if (dist < bestd)

				  {

					  a = p[2] - r;
					  if (a < 0)a = -a;
					  dist += a;
					  if (dist < bestd)
					  {
						  bestd = dist;
						  best = p[3];
					  }

				  }

			  }

		  }

		}

	    return (best);

	  }

	  var process = exports.process = function process()/*ByteArray*/
	  {

	    learn();
	    unbiasnet();
	    inxbuild();
	    return colorMap();

	  }

	  /*
	  * Unbias network to give byte values 0..255 and record position i to prepare
	  * for sort
	  * -----------------------------------------------------------------------------------
	  */

	  var unbiasnet = function unbiasnet()/*void*/

	  {

	    var i/*int*/;
	    var j/*int*/;

	    for (i = 0; i < netsize; i++)
		{
	      network[i][0] >>= netbiasshift;
	      network[i][1] >>= netbiasshift;
	      network[i][2] >>= netbiasshift;
	      network[i][3] = i; /* record colour no */
	    }

	  }

	  /*
	  * Move adjacent neurons by precomputed alpha*(1-((i-j)^2/[r]^2)) in
	  * radpower[|i-j|]
	  * ---------------------------------------------------------------------------------
	  */

	  var alterneigh = function alterneigh(rad/*int*/, i/*int*/, b/*int*/, g/*int*/, r/*int*/)/*void*/

	  {

		  var j/*int*/;
		  var k/*int*/;
		  var lo/*int*/;
		  var hi/*int*/;
		  var a/*int*/;
		  var m/*int*/;

		  var p/*Array*/;

		  lo = i - rad;
		  if (lo < -1) lo = -1;

		  hi = i + rad;

		  if (hi > netsize) hi = netsize;

		  j = i + 1;
		  k = i - 1;
		  m = 1;

		  while ((j < hi) || (k > lo))

		  {

			  a = radpower[m++];

			  if (j < hi)

			  {

				  p = network[j++];

				  try {

					  p[0] -= (a * (p[0] - b)) / alpharadbias;
					  p[1] -= (a * (p[1] - g)) / alpharadbias;
					  p[2] -= (a * (p[2] - r)) / alpharadbias;

					  } catch (e/*Error*/) {} // prevents 1.3 miscompilation

				}

				if (k > lo)

				{

					p = network[k--];

					try
					{

						p[0] -= (a * (p[0] - b)) / alpharadbias;
						p[1] -= (a * (p[1] - g)) / alpharadbias;
						p[2] -= (a * (p[2] - r)) / alpharadbias;

					} catch (e/*Error*/) {}

				}

		  }

	  }

	  /*
	  * Move neuron i towards biased (b,g,r) by factor alpha
	  * ----------------------------------------------------
	  */

	  var altersingle = function altersingle(alpha/*int*/, i/*int*/, b/*int*/, g/*int*/, r/*int*/)/*void*/
	  {

		  /* alter hit neuron */
		  var n/*Array*/ = network[i];
		  n[0] -= (alpha * (n[0] - b)) / initalpha;
		  n[1] -= (alpha * (n[1] - g)) / initalpha;
		  n[2] -= (alpha * (n[2] - r)) / initalpha;

	  }

	  /*
	  * Search for biased BGR values ----------------------------
	  */

	  var contest = function contest(b/*int*/, g/*int*/, r/*int*/)/*int*/
	  {

		  /* finds closest neuron (min dist) and updates freq */
		  /* finds best neuron (min dist-bias) and returns position */
		  /* for frequently chosen neurons, freq[i] is high and bias[i] is negative */
		  /* bias[i] = gamma*((1/netsize)-freq[i]) */

		  var i/*int*/;
		  var dist/*int*/;
		  var a/*int*/;
		  var biasdist/*int*/;
		  var betafreq/*int*/;
		  var bestpos/*int*/;
		  var bestbiaspos/*int*/;
		  var bestd/*int*/;
		  var bestbiasd/*int*/;
		  var n/*Array*/;

		  bestd = ~(1 << 31);
		  bestbiasd = bestd;
		  bestpos = -1;
		  bestbiaspos = bestpos;

		  for (i = 0; i < netsize; i++)

		  {

			  n = network[i];
			  dist = n[0] - b;

			  if (dist < 0) dist = -dist;

			  a = n[1] - g;

			  if (a < 0) a = -a;

			  dist += a;

			  a = n[2] - r;

			  if (a < 0) a = -a;

			  dist += a;

			  if (dist < bestd)

			  {

				  bestd = dist;
				  bestpos = i;

			  }

			  biasdist = dist - ((bias[i]) >> (intbiasshift - netbiasshift));

			  if (biasdist < bestbiasd)

			  {

				  bestbiasd = biasdist;
				  bestbiaspos = i;

			  }

			  betafreq = (freq[i] >> betashift);
			  freq[i] -= betafreq;
			  bias[i] += (betafreq << gammashift);

		  }

		  freq[bestpos] += beta;
		  bias[bestpos] -= betagamma;
		  return (bestbiaspos);

	  }

	  NeuQuant.apply(this, arguments);
	  return exports;
	}

},{}],5:[function(require,module,exports){

},{}],6:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192

/**
 * If `TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Note:
 *
 * - Implementation must support adding new properties to `Uint8Array` instances.
 *   Firefox 4-29 lacked support, fixed in Firefox 30+.
 *   See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *  - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *  - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *    incorrect length in some situations.
 *
 * We detect these buggy browsers and set `TYPED_ARRAY_SUPPORT` to `false` so they will
 * get the Object implementation, which is slower but will work correctly.
 */
var TYPED_ARRAY_SUPPORT = (function () {
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        new Uint8Array(1).subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Find the length
  var length
  if (type === 'number')
    length = subject > 0 ? subject >>> 0 : 0
  else if (type === 'string') {
    if (encoding === 'base64')
      subject = base64clean(subject)
    length = Buffer.byteLength(subject, encoding)
  } else if (type === 'object' && subject !== null) { // assume object is array-like
    if (subject.type === 'Buffer' && isArray(subject.data))
      subject = subject.data
    length = +subject.length > 0 ? Math.floor(+subject.length) : 0
  } else
    throw new Error('First argument needs to be a number, array or string.')

  var buf
  if (TYPED_ARRAY_SUPPORT) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (TYPED_ARRAY_SUPPORT && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    if (Buffer.isBuffer(subject)) {
      for (i = 0; i < length; i++)
        buf[i] = subject.readUInt8(i)
    } else {
      for (i = 0; i < length; i++)
        buf[i] = ((subject[i] % 256) + 256) % 256
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !TYPED_ARRAY_SUPPORT && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

// STATIC METHODS
// ==============

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.isBuffer = function (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str.toString()
  switch (encoding || 'utf8') {
    case 'hex':
      ret = str.length / 2
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.concat = function (list, totalLength) {
  assert(isArray(list), 'Usage: Buffer.concat(list[, length])')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (totalLength === undefined) {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

Buffer.compare = function (a, b) {
  assert(Buffer.isBuffer(a) && Buffer.isBuffer(b), 'Arguments must be Buffers')
  var x = a.length
  var y = b.length
  for (var i = 0, len = Math.min(x, y); i < len && a[i] === b[i]; i++) {}
  if (i !== len) {
    x = a[i]
    y = b[i]
  }
  if (x < y) {
    return -1
  }
  if (y < x) {
    return 1
  }
  return 0
}

// BUFFER INSTANCE METHODS
// =======================

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  assert(strLen % 2 === 0, 'Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    assert(!isNaN(byte), 'Invalid hex string')
    buf[offset + i] = byte
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function asciiWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function utf16leWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf16leToBytes(string), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leWrite(this, string, offset, length)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toString = function (encoding, start, end) {
  var self = this

  encoding = String(encoding || 'utf8').toLowerCase()
  start = Number(start) || 0
  end = (end === undefined) ? self.length : Number(end)

  // Fastpath empty strings
  if (end === start)
    return ''

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexSlice(self, start, end)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Slice(self, start, end)
      break
    case 'ascii':
      ret = asciiSlice(self, start, end)
      break
    case 'binary':
      ret = binarySlice(self, start, end)
      break
    case 'base64':
      ret = base64Slice(self, start, end)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leSlice(self, start, end)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

Buffer.prototype.equals = function (b) {
  assert(Buffer.isBuffer(b), 'Argument must be a Buffer')
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.compare = function (b) {
  assert(Buffer.isBuffer(b), 'Argument must be a Buffer')
  return Buffer.compare(this, b)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  assert(end >= start, 'sourceEnd < sourceStart')
  assert(target_start >= 0 && target_start < target.length,
      'targetStart out of bounds')
  assert(start >= 0 && start < source.length, 'sourceStart out of bounds')
  assert(end >= 0 && end <= source.length, 'sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 100 || !TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < len; i++) {
      target[i + target_start] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function binarySlice (buf, start, end) {
  return asciiSlice(buf, start, end)
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len;
    if (start < 0)
      start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0)
      end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start)
    end = start

  if (TYPED_ARRAY_SUPPORT) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  return this[offset]
}

function readUInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    val = buf[offset]
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
  } else {
    val = buf[offset] << 8
    if (offset + 1 < len)
      val |= buf[offset + 1]
  }
  return val
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  return readUInt16(this, offset, true, noAssert)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  return readUInt16(this, offset, false, noAssert)
}

function readUInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    if (offset + 2 < len)
      val = buf[offset + 2] << 16
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
    val |= buf[offset]
    if (offset + 3 < len)
      val = val + (buf[offset + 3] << 24 >>> 0)
  } else {
    if (offset + 1 < len)
      val = buf[offset + 1] << 16
    if (offset + 2 < len)
      val |= buf[offset + 2] << 8
    if (offset + 3 < len)
      val |= buf[offset + 3]
    val = val + (buf[offset] << 24 >>> 0)
  }
  return val
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  return readUInt32(this, offset, true, noAssert)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  return readUInt32(this, offset, false, noAssert)
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null,
        'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  var neg = this[offset] & 0x80
  if (neg)
    return (0xff - this[offset] + 1) * -1
  else
    return this[offset]
}

function readInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = readUInt16(buf, offset, littleEndian, true)
  var neg = val & 0x8000
  if (neg)
    return (0xffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  return readInt16(this, offset, true, noAssert)
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  return readInt16(this, offset, false, noAssert)
}

function readInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = readUInt32(buf, offset, littleEndian, true)
  var neg = val & 0x80000000
  if (neg)
    return (0xffffffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  return readInt32(this, offset, true, noAssert)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  return readInt32(this, offset, false, noAssert)
}

function readFloat (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 23, 4)
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  return readFloat(this, offset, true, noAssert)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  return readFloat(this, offset, false, noAssert)
}

function readDouble (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 7 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 52, 8)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  return readDouble(this, offset, true, noAssert)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  return readDouble(this, offset, false, noAssert)
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'trying to write beyond buffer length')
    verifuint(value, 0xff)
  }

  if (offset >= this.length) return

  this[offset] = value
  return offset + 1
}

function writeUInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 2); i < j; i++) {
    buf[offset + i] =
        (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
            (littleEndian ? i : 1 - i) * 8
  }
  return offset + 2
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  return writeUInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  return writeUInt16(this, value, offset, false, noAssert)
}

function writeUInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffffffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 4); i < j; i++) {
    buf[offset + i] =
        (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
  return offset + 4
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  return writeUInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  return writeUInt32(this, value, offset, false, noAssert)
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7f, -0x80)
  }

  if (offset >= this.length)
    return

  if (value >= 0)
    this.writeUInt8(value, offset, noAssert)
  else
    this.writeUInt8(0xff + value + 1, offset, noAssert)
  return offset + 1
}

function writeInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fff, -0x8000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    writeUInt16(buf, value, offset, littleEndian, noAssert)
  else
    writeUInt16(buf, 0xffff + value + 1, offset, littleEndian, noAssert)
  return offset + 2
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  return writeInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  return writeInt16(this, value, offset, false, noAssert)
}

function writeInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fffffff, -0x80000000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    writeUInt32(buf, value, offset, littleEndian, noAssert)
  else
    writeUInt32(buf, 0xffffffff + value + 1, offset, littleEndian, noAssert)
  return offset + 4
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  return writeInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  return writeInt32(this, value, offset, false, noAssert)
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 7 < buf.length,
        'Trying to write beyond buffer length')
    verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  assert(end >= start, 'end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  assert(start >= 0 && start < this.length, 'start out of bounds')
  assert(end >= 0 && end <= this.length, 'end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

Buffer.prototype.inspect = function () {
  var out = []
  var len = this.length
  for (var i = 0; i < len; i++) {
    out[i] = toHex(this[i])
    if (i === exports.INSPECT_MAX_BYTES) {
      out[i + 1] = '...'
      break
    }
  }
  return '<Buffer ' + out.join(' ') + '>'
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new Error('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-z]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function isArray (subject) {
  return (Array.isArray || function (subject) {
    return Object.prototype.toString.call(subject) === '[object Array]'
  })(subject)
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F) {
      byteArray.push(b)
    } else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++) {
        byteArray.push(parseInt(h[j], 16))
      }
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

/*
 * We have to make sure that the value is a valid integer. This means that it
 * is non-negative. It has no fractional component and that it does not
 * exceed the maximum allowed value.
 */
function verifuint (value, max) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value >= 0, 'specified a negative value for writing an unsigned value')
  assert(value <= max, 'value is larger than maximum value for type')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifsint (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifIEEE754 (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
}

function assert (test, message) {
  if (!test) throw new Error(message || 'Failed assertion')
}

},{"base64-js":7,"ieee754":8}],7:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS)
			return 62 // '+'
		if (code === SLASH)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],8:[function(require,module,exports){
exports.read = function(buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

},{}]},{},[2]);
