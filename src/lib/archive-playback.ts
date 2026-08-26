export async function loadArchiveItemForPlayback(identifier: string) {
  const res = await fetch(`/api/archive/resolve/${identifier}`);
  const data = await res.json();
  
  if (data.error) throw new Error(data.error);

  // Map to your standard schema
  return {
    tvgId: data.identifier,
    title: data.title,
    url: data.safeUrl, // CRITICAL: This is the normalized /download/ URL
    duration: data.duration,
    sourceHost: "archive.org",
    contentType: "archive"
  };
}
