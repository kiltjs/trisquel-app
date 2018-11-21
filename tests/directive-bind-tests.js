/* global describe, it, beforeEach, assert, APP */

describe('directive [data-bind]', function () {

  beforeEach(function () {
    while( document.body.firstChild ) {
      document.body.removeChild(document.body.firstChild)
    }
  })

  var _APP = APP.createApp()
  _APP.defineFilter('bar', function (text) {
    return text + 'bar'
  })

  it('render error', function () {

    assert.throws( function () {

      _APP.render(document.body, [{
        $: 'div',
        attrs: {
          'data-bind': ' foo ',
        },
      }])

    }, TypeError )

  })

  it('render foobar', function () {

    _APP.render(document.body, [{
      $: 'div',
      attrs: {
        'data-bind': ' foo ',
      },
    }], {
      data: {
        foo: 'foobar'
      },
    })

    assert.strictEqual(document.body.innerHTML, '<div data-bind=" foo ">foobar</div>')

  })

  it('render foo | bar', function () {

    _APP.render(document.body, [{
      $: 'div',
      attrs: {
        'data-bind': ' foo | bar ',
      },
    }], {
      data: {
        foo: 'foo'
      },
    })

    assert.strictEqual(document.body.innerHTML, '<div data-bind=" foo | bar ">foobar</div>')

  })

})