import React, { useRef } from 'react';
import { renderToString } from 'react-dom/server';

function Test() {
  const setRef = (el: any) => {
    if (el) {
      el.muted = true;
    }
  };
  return <video ref={setRef} autoPlay />;
}
console.log("OK");
