export interface RepoConfig {
  modo: 'lista' | 'organizacion';
  repos?: { owner: string; repo: string }[];
  org?: string;
}