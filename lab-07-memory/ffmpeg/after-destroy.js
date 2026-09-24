const ffmpeg = require('bare-ffmpeg')

const frame = new ffmpeg.Frame()
frame.destroy()
console.log('frame.destroy(), then frame.width')
console.log(frame.width)
