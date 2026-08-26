function extractArchiveIdentifier(input) {
  if (!input) return '';
  let sanitized = input.trim().replace(/\/+$/, '');
  
  const archiveUrlPattern = /archive\.org\/(?:details|download|metadata|embed)\/([^\/\?#]+)/i;
  const match = sanitized.match(archiveUrlPattern);
  
  if (match && match[1]) {
    return match[1];
  }
  
  if (sanitized.includes('://')) {
    const parts = sanitized.split('/');
    return parts[parts.length - 1] || '';
  }
  
  return sanitized;
}
console.log(extractArchiveIdentifier("ALF The Complete Series"));
