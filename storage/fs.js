'use strict'

var pump = require('pump')
var raco = require('raco')({ prepend: true })
var fs = require('fs')
var path = require('path')
var mkdirp = require('mkdirp')
var errors = require('../errors')

class Store {
  constructor (base, opts) {
    this._base = path.resolve(base)
    this._opts = opts || {}
  }

  static match (base) {
    return typeof base === 'string'
  }

  _getPath (key) {
    var filepath = path.join(this._base, key)
    if (filepath.indexOf(this._base) !== 0) throw new errors.KeyError(`Invalid key ${key}`)
    return filepath
  }

  * getToWriteStream (next, key, writeStream, size) {
    var readStream = fs.createReadStream(this._getPath(key))
    yield pump(readStream, writeStream, (err) => {
      if (err && err.code === 'ENOENT') return next(new errors.NotFoundError(`Key ${key} not found`, err))
      else return next(err)
    })
  }

  * getToFile (next, key, filepath) {
    var keypath = this._getPath(key)
    var readStream = fs.createReadStream(keypath)
    var writeStream = fs.createWriteStream(filepath)
    yield pump(readStream, writeStream, (err) => {
      if (err && err.code === 'ENOENT') return next(new errors.NotFoundError(`Key ${key} not found`, err))
      else return next(err)
    })
  }

  * get (next, key) {
    return yield fs.readFile(this._getPath(key), {
      encoding: 'utf8',
      flag: 'r'
    }, (err, val) => {
      if (err && err.code === 'ENOENT') return next(new errors.NotFoundError(`Key ${key} not found`, err))
      else if (err) return next(err)
      else return next(null, val)
    })
  }

  * putFromReadStream (next, key, readStream) {
    var keypath = this._getPath(key)
    if (this._opts.mkdirp !== false) {
      yield mkdirp(path.dirname(keypath), next)
    }
    var writeStream = fs.createWriteStream(keypath)
    yield pump(readStream, writeStream, next)
    return {
      size: writeStream.bytesWritten
    }
  }

  * putFromFile (next, key, filepath) {
    var keypath = this._getPath(key)
    if (this._opts.mkdirp !== false) {
      yield mkdirp(path.dirname(keypath), next)
    }
    var readStream = fs.createReadStream(filepath)
    var writeStream = fs.createWriteStream(keypath)
    yield pump(readStream, writeStream, next)
  }

  * put (next, key, val) {
    console.log(key, val)
    var keypath = this._getPath(key)
    if (this._opts.mkdirp !== false) {
      yield mkdirp(path.dirname(keypath), next)
    }
    return yield fs.writeFile(keypath, val, {
      encoding: 'utf8',
      mode: '0666',
      flag: 'w'
    }, next)
  }

  * exists (next, key) {
    return yield fs.stat(this._getPath(key), (err) => {
      if (err && err.code === 'ENOENT') return next(null, false)
      else if (err) return next(err)
      else return next(null, true)
    })
  }

  * remove (next, key) {
    return yield fs.unlink(this._getPath(key), (err) => {
      if (err && err.code === 'ENOENT') return next(null, false)
      else if (err) return next(err)
      else return next(null, true)
    })
  }
}

raco.wrapAll(Store.prototype)

module.exports = Store