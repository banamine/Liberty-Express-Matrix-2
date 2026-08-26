const fs = require('fs');
let code = fs.readFileSync('src/pages/tv.tsx', 'utf8');

// HLS Cleanup
code = code.replace(
  `    } else {
      videoRef.current.src = currentUrl;
      videoRef.current.load();
    }
  }, [currentUrl]);`,
  `    } else {
      videoRef.current.src = currentUrl;
      videoRef.current.load();
    }
    
    return () => {
      if (hlsRef.current) {
        hlsRef.current.detachMedia();
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentUrl]);`
);

fs.writeFileSync('src/pages/tv.tsx', code);
