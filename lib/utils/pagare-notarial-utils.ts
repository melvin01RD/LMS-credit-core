export function generateNumeroActo(): string {
  const now = new Date();
  const year = now.getFullYear();
  const seq = (now.getTime() % 10000).toString().padStart(4, '0');
  return `${year}-${seq}`;
}
