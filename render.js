
var _ = require('./utils'),
    renderNodes = require('@triskel/render')

function _noop () {}

module.exports = RenderApp

function RenderApp (_options) {
  // var options = Object.create(_options || {})

  this.with_node_pipe = []

  this.options = _options ||{}
}

RenderApp.prototype.simpleRender = renderNodes

function _isInList(list, item) {
  for( var i = list.length - 1; i >= 0 ; i-- ) {
    if( item === list[i] ) return true
  }
  return false
}

RenderApp.prototype.render = function (parent_el, nodes, _options) {
  if( nodes instanceof Array === false ) throw new TypeError('render nodes should be an Array')

  _options = _options || {}
  var APP = Object.create(this),
      render_options = _.extend( Object.create( APP.options || {} ), _options ),
      with_node_pipe = APP.with_node_pipe,
      detach_queue = [],
      _processDetachQueue = function (detached_nodes) {
        for( var i = detach_queue.length - 1 ; i >= 0 ; i-- ) {
          if( _isInList(detached_nodes, detach_queue[i].el) ) {
            detach_queue[i].listener.call(detach_queue[i].el)
            detach_queue.splice(i, 1)
          }
        }
        if( detach_queue.length === 0 ) mutation_observer.disconnect()
      },
      mutation_observer = 'MutationObserver' in window ? new MutationObserver(function(mutations) {

        mutations.forEach(function(mutation) {
          _processDetachQueue(mutation.removedNodes)
        })

      }) : { observe: _noop, disconnect: _noop }

  function _onDetach (listener) {
    if( !detach_queue.length ) mutation_observer.observe(parent_el, { childList: true, subtree: true })
    detach_queue.push({ el: this, listener: listener })
  }

  parent_el = parent_el || document.createElement('div')

  var safe_render_options = Object.create(render_options)
  safe_render_options.withNode = null

  render_options.withNode = function (node) {
    var with_node = {},
        init_pipe = [],
        i, n, result_with_node,
        _with_node_pipe = with_node_pipe

    if( _options.withNode ) {
      _with_node_pipe = _with_node_pipe.slice()
      _with_node_pipe.unshift(_options.withNode)
    }

    for( i = 0, n = _with_node_pipe.length ; i < n ; i++ ) {
      result_with_node = _with_node_pipe[i] instanceof Function ?
        _with_node_pipe[i].call(APP, node, safe_render_options, with_node) :
        _with_node_pipe[i]

      if( result_with_node ) {
        if( result_with_node.replace_by_comment ) return result_with_node

        if( result_with_node.initNode ) {
          if( typeof result_with_node.initNode !== 'function' ) {
            console.error('initNode should be a function', result_with_node.initNode ); // eslint-disable-line
            throw new TypeError('initNode should be a Function')
          }

          init_pipe.push(result_with_node.initNode)
          // delete result_with_node.initNode; // will be overriden if init_pipe.length
        }

        with_node = _.extend( with_node, result_with_node )
      }
    }

    if( init_pipe.length ) {
      with_node.initNode = function (node_el) {
        var _this = Object.create(APP)
        _this.onDetach = _onDetach.bind(node_el)

        for( var i = 0, n = init_pipe.length; i < n ; i++ ) {
          // init_pipe[i].call(node_el, node_el, node, with_node);
          init_pipe[i].apply(_this, arguments)
        }
      }
    }

    return with_node
  }

  return renderNodes(parent_el, nodes, render_options)
}

RenderApp.prototype.withNode = function (withNode) {
  this.with_node_pipe.push(withNode)
  return this
}

RenderApp.prototype.component = function (tag_name, options, template_options) {
  var render_app = this

  if( options instanceof Function ) options = { controller: options }
  else if( !options || typeof options !== 'object' ) {
    throw new TypeError('options should be a plain object (or a controller function)')
  }

  template_options = template_options ? Object.create(template_options) : {}
  if( !template_options.data && options.data ) template_options.data = options.data
  
  render_app.withNode(function (node) {

    if( node.$ !== tag_name ) return

    var _with_node = options.withNode && options.withNode.apply(render_app, arguments) || {},
        _initNode = _with_node.initNode

    return _.extend( _with_node, {
      initNode: options.controller && options.template ? function (node_el, _node, render_options) {
        var _this = Object.create(this), _args = arguments

        if( !template_options.data && render_options.data ) template_options.data = render_options.data
        var template_ctrl = render_app.render(node_el, options.template, template_options)

        _this.updateData = template_ctrl.updateData
        _this.watchData(function () {
          template_ctrl.updateData()
        })

        if( _initNode instanceof Function ) _initNode.apply(_this, arguments)
        options.controller.apply(_this, _args)
      } : function (node_el, _node, render_options) {
        var _this = Object.create(this),
            _template_ctrl
        
        if( options.template ) {
          if( !template_options.data && render_options.data ) template_options.data = render_options.data
          _template_ctrl = render_app.render(node_el, options.template, template_options)
          _this.updateData = _template_ctrl.updateData
          _this.watchData(function () {
            _template_ctrl.updateData()
          })
        }

        if( _initNode instanceof Function ) _initNode.apply(_this, arguments)
        if( options.controller instanceof Function ) options.controller.apply(_this, arguments)
      },
    })

  })

  return this
}

function _autoWithNode (withNode) {
  if( withNode instanceof Function ) return withNode
  if( withNode && typeof withNode === 'object' ) return function () {
    return withNode
  }
}

RenderApp.prototype.directive = function (directive, initNode, withNode) {

  if( directive instanceof RegExp ) directive = '^' + directive.source.replace(/^\^|\$$/g, '') + '$'
  directive = '^' + directive.replace(/^\^|\$$/, '') + '$'

  var matchRE = new RegExp(directive),
      matchAttr = function (attr) {
        return matchRE.test(attr)
      },
      _withNode = _autoWithNode(withNode)

  this.withNode(function (node, _render_options) {
    var _attrs = node.attrs || {},
        attr_key = _attrs && _.find( Object.keys(_attrs), matchAttr)

    if( !attr_key ) return
    if( node._using_directive === attr_key ) return

    var this_app = Object.create(this)

    this_app.attr_key = attr_key
    this_app.attr_value = _attrs[attr_key]

    return _.extend( _withNode && _withNode.apply(this_app, arguments) || {}, {
      initNode: function (node_el, _node, render_options, _with_node) {
        if( _with_node.replace_by_comment ) {
          _node = Object.create(_node)
          _node._using_directive = attr_key
        }

        initNode.call(this_app, node_el, _node, render_options, _with_node )
      },
    })

  })

  return this
}
