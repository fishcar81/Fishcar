/* Browser bridge for the C++ / WebAssembly hint solver. */
window.GoldenScapegoatHint = (() => {
  let modulePromise;
  function loadModule() {
    if (modulePromise) return modulePromise;
    modulePromise = new Promise((resolve, reject) => {
      const start = () => {
        try {
          const factory = window.GoldenScapegoatSolver;
          if (typeof factory !== 'function') throw new Error('C++ 求解模块未初始化');
          Promise.resolve(factory({ locateFile: file => `../cpp-solver/${file}` })).then(resolve, reject);
        } catch (error) { reject(error); }
      };
      if (typeof window.GoldenScapegoatSolver === 'function') { start(); return; }
      const script = document.createElement('script');
      script.src = '../cpp-solver/golden-solver.js';
      script.async = true;
      script.onload = start;
      script.onerror = () => reject(new Error('无法加载 C++ 提示模块'));
      document.head.appendChild(script);
    });
    return modulePromise;
  }
  return async request => {
    const module = await loadModule();
    return module.cwrap('golden_hint', 'string', ['string'])(request);
  };
})();
