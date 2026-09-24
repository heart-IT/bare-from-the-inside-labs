const ffmpeg = require('bare-ffmpeg')
const { pixelFormats } = ffmpeg.constants

function encode () {
  using encoder = new ffmpeg.CodecContext(ffmpeg.Codec.MJPEG.encoder)
  encoder.width = 64
  encoder.height = 64
  encoder.pixelFormat = pixelFormats.YUVJ420P
  encoder.timeBase = new ffmpeg.Rational(1, 30)
  encoder.open()

  const image = new ffmpeg.Image(pixelFormats.YUVJ420P, 64, 64)
  image.data.fill(128)

  using frame = new ffmpeg.Frame()
  frame.width = 64
  frame.height = 64
  frame.format = pixelFormats.YUVJ420P
  image.fill(frame)

  using packet = new ffmpeg.Packet()
  encoder.sendFrame(frame)
  encoder.receivePacket(packet)

  console.log('frame._handle →', frame._handle)
  console.log('  its 8 bytes are an address:', new BigUint64Array(frame._handle)[0] !== 0n)

  const a = packet.data
  const b = packet.data
  console.log('packet.data →', a.byteLength, 'bytes, from', a.subarray(0, 2), 'to', a.subarray(-2))
  console.log('  read twice, same memory:', a.buffer === b.buffer)

  return { frame, packet }
}

const { frame, packet } = encode()
console.log('after the block: frame._handle →', frame._handle, '· packet._handle →', packet._handle)
