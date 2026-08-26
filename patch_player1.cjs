const fs = require('fs');
let code = fs.readFileSync('src/pages/player1.tsx', 'utf8');

// 1. AudioContext cleanup
code = code.replace(
  'const compressor = ctx.createDynamicsCompressor();',
  'const compressor = ctx.createDynamicsCompressor();\n        compressorRef.current = compressor;'
);
// We need to define compressorRef
code = code.replace(
  'const audioSetupDoneRef = useRef(false);',
  'const audioSetupDoneRef = useRef(false);\n  const compressorRef = useRef<any>(null);'
);

code = code.replace(
  `      } catch (e) {
        console.error("Audio setup error:", e);
      }
    }
  }, []);`,
  `      } catch (e) {
        console.error("Audio setup error:", e);
      }
    }

    return () => {
      if (compressorRef.current) {
        compressorRef.current.disconnect();
        compressorRef.current = null;
      }
    };
  }, []);`
);

// 2. HLS Cleanup
code = code.replace(
  `    } else {
      videoRef.current.src = targetUrl;
      videoRef.current.load();
      // The onLoadedMetadata handler in the JSX will handle this
    }
    
    // Don't set PLAYING immediately, wait for video events
  }, [targetUrl, currentItem]);`,
  `    } else {
      videoRef.current.src = targetUrl;
      videoRef.current.load();
      // The onLoadedMetadata handler in the JSX will handle this
    }
    
    return () => {
      if (hlsRef.current) {
        hlsRef.current.detachMedia();
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [targetUrl, currentItem]);`
);

fs.writeFileSync('src/pages/player1.tsx', code);
