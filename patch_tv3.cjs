const fs = require('fs');
let code = fs.readFileSync('src/pages/tv.tsx', 'utf8');

code = code.replace(
  `      });
    }
  }, [currentUrl, activeChannel]);`,
  `      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.detachMedia();
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentUrl, activeChannel]);`
);

fs.writeFileSync('src/pages/tv.tsx', code);
