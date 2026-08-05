(function() {
  'use strict';

  if (!window.React || !window.ReactDOM) {
    console.warn('[ImagePreview] React/ReactDOM 未加载，预览窗口不可用');
    return;
  }

  var React = window.React;
  var ReactDOM = window.ReactDOM;
  var createElement = React.createElement;
  var useState = React.useState;
  var useRef = React.useRef;
  var useEffect = React.useEffect;

  // 全局创建函数：window.createImagePreviewWindow(image, options)
  window.createImagePreviewWindow = function(image, options) {
    if (!image || !image.url) return;
    var opts = options || {};
    var displayName = image.displayName || image.name || '图片预览';
    var codeName = opts.title || 'imagePreviewWindow.js';
    var outerTitle = codeName + ' — ' + displayName;

    var id = 'image-preview-container-' + Date.now();
    var container = document.createElement('div');
    container.id = id;
    document.body.appendChild(container);

    function closeWindow() {
      try { ReactDOM.unmountComponentAtNode(container); } catch(e) {}
      if (container.parentNode) container.parentNode.removeChild(container);
    }

    function ImagePreviewApp(props) {
      var _s1 = useState(1);
      var scale = _s1[0];
      var setScale = _s1[1];

      var _s2 = useState(0);
      var ox = _s2[0];
      var setOx = _s2[1];

      var _s3 = useState(0);
      var oy = _s3[0];
      var setOy = _s3[1];

      var _s4 = useState(false);
      var isPanning = _s4[0];
      var setIsPanning = _s4[1];

      var imgRef = useRef(null);
      var wrapRef = useRef(null);
      var startRef = useRef({x:0,y:0,ox:0,oy:0});

      useEffect(function() {
        function onKey(e) {
          if (e.key === 'Escape') { closeWindow(); }
          else if (e.key === '+') { setScale(function(s) { return Math.min(5, s * 1.2); }); }
          else if (e.key === '-') { setScale(function(s) { return Math.max(0.1, s / 1.2); }); }
        }
        window.addEventListener('keydown', onKey);
        return function() { window.removeEventListener('keydown', onKey); };
      }, []);

      function onWheel(e) {
        e.preventDefault();
        var delta = e.deltaY > 0 ? 0.9 : 1.1;
        var newScale = Math.max(0.1, Math.min(8, scale * delta));
        setScale(newScale);
      }

      function startPan(e) {
        e.preventDefault();
        setIsPanning(true);
        startRef.current.x = e.clientX;
        startRef.current.y = e.clientY;
        startRef.current.ox = ox;
        startRef.current.oy = oy;
        try { e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); } catch(e) {}
      }

      function movePan(e) {
        if (!isPanning) return;
        var dx = e.clientX - startRef.current.x;
        var dy = e.clientY - startRef.current.y;
        setOx(startRef.current.ox + dx);
        setOy(startRef.current.oy + dy);
      }

      function endPan(e) {
        setIsPanning(false);
        try { e.target.releasePointerCapture && e.target.releasePointerCapture(e.pointerId); } catch(e) {}
      }

      function fitToWindow() {
        // 重置平移与缩放，然后让图片自适应容器通过 CSS max-width/max-height
        setScale(1);
        setOx(0);
        setOy(0);
      }

      function zoomIn() { setScale(function(s) { return Math.min(8, s * 1.2); }); }
      function zoomOut() { setScale(function(s) { return Math.max(0.1, s / 1.2); }); }

      function downloadImage() {
        var link = document.createElement('a');
        link.href = props.src;
        link.download = props.name || 'image.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      return createElement('div', {
        style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0b1121' }
      },
        // header: toolbar moved to left so it won't be hidden by outer floating header
        createElement('div', { style: { padding: '10px 14px', background: '#0f172a', color: '#e6eef8', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' } },
          createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            createElement('button', { onClick: fitToWindow, title: '适应窗口', style: buttonStyle() }, '适应'),
            createElement('button', { onClick: zoomOut, title: '缩小', style: buttonStyle() }, '−'),
            createElement('button', { onClick: zoomIn, title: '放大', style: buttonStyle() }, '+'),
            createElement('button', { onClick: downloadImage, title: '下载', style: buttonStyle() }, '⬇'),
            createElement('button', { onClick: closeWindow, title: '关闭', style: buttonStyle() }, '关闭')
          ),
          // displayName shown near toolbar
          createElement('div', { style: { marginLeft: '8px', color: '#dbeafe', fontSize: '13px', fontWeight: 600 } }, displayName)
        ),

        createElement('div', {
          ref: wrapRef,
          onWheel: onWheel,
          onPointerDown: startPan,
          onPointerMove: movePan,
          onPointerUp: endPan,
          onPointerCancel: endPan,
          style: { flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1220' }
        },
          createElement('div', { style: { position: 'relative', display: 'inline-block' } },
            createElement('img', {
              ref: imgRef,
              src: props.src,
              alt: props.name || 'preview',
              onDragStart: function(e) { e.preventDefault(); },
              style: {
                transform: 'translate(' + ox + 'px, ' + oy + 'px) scale(' + scale + ')',
                transformOrigin: 'center center',
                transition: isPanning ? 'none' : 'transform 120ms ease-out',
                maxWidth: '100%',
                maxHeight: '100%',
                display: 'block',
                borderRadius: '6px'
              }
            })
          )
        )
      );
    }

    // 简单按钮样式函数
    function buttonStyle() {
      return {
        padding: '6px 10px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.04)',
        color: '#e6eef8',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '13px'
      };
    }

    ReactDOM.render(
      createElement(window.FloatingWindowReact || function(p){ return createElement(ImagePreviewApp, p); }, { isOpen: true, width: '820px', height: '640px', onClose: closeWindow, title: outerTitle }, createElement(ImagePreviewApp, { src: image.url, name: image.name })),
      container
    );

    return { close: closeWindow };
  };

})();
