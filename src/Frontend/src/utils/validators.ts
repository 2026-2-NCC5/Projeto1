export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

export const isValidRA = (ra: string): boolean => {
  const clean = ra.replace(/\D/g, '');
  return clean.length >= 6 && clean.length <= 10;
};

export const isValidPassword = (password: string): boolean => {
  return password.length >= 6;
};
