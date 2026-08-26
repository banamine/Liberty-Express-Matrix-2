const fs = require('fs');
let code = fs.readFileSync('src/pages/archive.tsx', 'utf8');

code = code.replace(
  'toast.success("Workspace cleared successfully.");',
  'toast({ title: "Workspace cleared successfully.", variant: "default" });'
);
code = code.replace(
  'toast.error("Failed to clear workspace.");',
  'toast({ title: "Failed to clear workspace.", variant: "destructive" });'
);

fs.writeFileSync('src/pages/archive.tsx', code);
console.log("Success");
