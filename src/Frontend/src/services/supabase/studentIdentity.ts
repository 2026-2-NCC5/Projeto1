import { supabase, isSupabaseConfigured } from './supabaseClient';
import { UserProfile } from '../../utils/constants';

export interface StudentIdentity {
  profileId: string;
  studentId: string | null;
  ra: string;
  name: string;
  course: string;
}

// Cache em memória para evitar requisições redundantes durante a sessão
const identityCache: Record<string, StudentIdentity> = {};

/**
 * Resolve a identidade completa do estudante cruzando o perfil (profiles) com a tabela de alunos (students)
 */
export async function resolveStudentIdentity(
  profile: UserProfile | null | undefined
): Promise<StudentIdentity | null> {
  if (!profile || !profile.ra) {
    return null;
  }

  const cleanRa = String(profile.ra).trim();
  const cacheKey = `${profile.id || ''}_${cleanRa}`;

  if (identityCache[cacheKey]) {
    return identityCache[cacheKey];
  }

  let studentId: string | null = null;
  let course = profile.course || 'Ciência da Computação';
  let name = profile.name || 'Estudante Alvarista';

  if (isSupabaseConfigured) {
    try {
      const { data: st, error } = await supabase
        .from('students')
        .select('id, ra, name, course')
        .eq('ra', cleanRa)
        .maybeSingle();

      if (!error && st) {
        studentId = st.id;
        if (st.name) name = st.name;
        if (st.course) course = st.course;
      }
    } catch (err) {
      console.warn('[studentIdentity] Erro ao resolver identidade no Supabase:', err);
    }
  }

  const identity: StudentIdentity = {
    profileId: profile.id,
    studentId,
    ra: cleanRa,
    name,
    course,
  };

  identityCache[cacheKey] = identity;
  return identity;
}

export function clearStudentIdentityCache() {
  Object.keys(identityCache).forEach((key) => delete identityCache[key]);
}
