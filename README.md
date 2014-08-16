gif-make.js
===========

This is a library for encoding GIF89a images that supports both the browser and Node environments. Resurrected from an old grade 12 project.

gif-make requires the following support: typed arrays, window.btoa.

Minimum browser support: Internet Explorer 10+, FireFox 30+, Chrome 27+, Safari 5.1+, Opera 23+.

Examples
===========

Examples of gif-make using the HTML5 FileReader API and pngjs in the Node environment can be found in the /examples dir.

Docs
===========
GIF(width, height [, defaultDelay = 1000, imageQuality = 10]) - constructor
-
Initializes a GIF object with the specified properties.

start()
-
Called before adding frames. This method starts the encoding process by writing the GIF89a header to the underlying ByteArray.

addFrame(imageContext [, delay = defaultDelay])
-
Add a GIF frame sto the underlying ByteArray given an imageContext and delay. The delay is the time shown for that frame only.

An imageContext can either be an HTML5 Canvas Context object or it can be an RGB array of pixels used as the image bitmap.

setDelay(ms)
-
Sets the default delay time for all frames that don't supply a delay parameter during addFrame().

toDataURI()
-
Returns a base64 data URI for the gif image.

saveToFile(name, cb [, path = ""])
-
Currently Node environments only.

Saves the gif image to path with the given name. cb is the callback function when the operation is complete.

finish()
-
Finishes the gif encoding process by adding the trailer byte to the underlying ByteArray.
