const fs = require('fs');
let code = fs.readFileSync('src/components/TimeTravelPlayerDialog.tsx', 'utf8');

code = code.replace(
  `    } else {
      videoRef.current.src = itemUrl;
      videoRef.current.load();
    }
  }, [itemUrl, timestamp]);`,
  `    } else {
      videoRef.current.src = itemUrl;
      videoRef.current.load();
    }
    
    return () => {
      if (hlsRef.current) {
        hlsRef.current.detachMedia();
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [itemUrl, timestamp]);`
);

fs.writeFileSync('src/components/TimeTravelPlayerDialog.tsx', code);
