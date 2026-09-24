/**
 * Formatadores utilitários com preservação exata de valores (sem arredondamentos indesejados)
 */

export const formatRA = (value: string): string => {
  const clean = value.replace(/\D/g, '');
  if (clean.length <= 8) {
    return clean;
  }
  return clean.slice(0, 8);
};

export const formatDateBR = (isoDateString: string): string => {
  if (!isoDateString) return '';
  const [year, month, day] = isoDateString.split('-');
  if (!year || !month || !day) return isoDateString;
  return `${day}/${month}/${year}`;
};

export const formatProtocol = (protocol: string): string => {
  return protocol.toUpperCase();
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
};
