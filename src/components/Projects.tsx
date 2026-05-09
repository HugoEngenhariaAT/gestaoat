import React, { useState, useEffect } from 'react';
import { Plus, Search, Building2, Trash2, Edit2, X, AlertCircle } from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { Project } from '../types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    status: 'ACTIVE' as const
  });

  const fetchProjects = async () => {
    try {
      const { data, error } = await getSupabase()
        .from('projects')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setProjects(data || []);
    } catch (err) {
      toast.error('Erro ao carregar empreendimentos: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await getSupabase()
        .from('projects')
        .insert([newProject]);

      if (error) throw error;

      toast.success('Empreendimento cadastrado com sucesso!');
      setIsModalOpen(false);
      setNewProject({ name: '', description: '', status: 'ACTIVE' });
      fetchProjects();
    } catch (err) {
      toast.error('Erro ao cadastrar: ' + (err as Error).message);
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    try {
      const { error } = await getSupabase()
        .from('projects')
        .update({
          name: selectedProject.name,
          description: selectedProject.description,
          status: selectedProject.status
        })
        .eq('id', selectedProject.id);

      if (error) throw error;

      toast.success('Empreendimento atualizado com sucesso!');
      setSelectedProject(null);
      fetchProjects();
    } catch (err) {
      toast.error('Erro ao atualizar: ' + (err as Error).message);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este empreendimento?')) return;

    try {
      const { error } = await getSupabase()
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Empreendimento excluído com sucesso!');
      fetchProjects();
    } catch (err) {
      toast.error('Erro ao excluir: ' + (err as Error).message);
    }
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-neutral-900 italic serif">Empreendimentos</h2>
          <p className="text-neutral-500">Gerencie as unidades e projetos da obra</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200"
        >
          <Plus size={20} />
          Novo Empreendimento
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
        <input 
          type="text" 
          placeholder="Buscar empreendimentos..."
          className="w-full pl-12 pr-4 py-4 bg-white border border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-white rounded-3xl border border-neutral-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <motion.div 
              layout
              key={project.id}
              className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-neutral-900 text-white rounded-2xl">
                  <Building2 size={24} />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setSelectedProject(project)}
                    className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-50 rounded-xl transition-all"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => handleDeleteProject(project.id)}
                    className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <h3 className="text-xl font-bold text-neutral-900 mb-1">{project.name}</h3>
              <p className="text-sm text-neutral-500 mb-4 line-clamp-2">{project.description || 'Sem descrição'}</p>
              
              <div className="flex items-center justify-between pt-4 border-t border-neutral-50">
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                  project.status === 'ACTIVE' ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-600"
                )}>
                  {project.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                </span>
                <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-widest">
                  {new Date(project.created_at).toLocaleDateString()}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-neutral-900 italic serif">Novo Empreendimento</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleCreateProject} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Nome</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
                    value={newProject.name}
                    onChange={(e) => setNewProject({...newProject, name: e.target.value.toUpperCase()})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Descrição</label>
                  <textarea 
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all min-h-[100px]"
                    value={newProject.description}
                    onChange={(e) => setNewProject({...newProject, description: e.target.value.toUpperCase()})}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 bg-neutral-100 text-neutral-700 rounded-xl font-bold hover:bg-neutral-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200"
                  >
                    Cadastrar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {selectedProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-neutral-900 italic serif">Editar Empreendimento</h3>
                <button onClick={() => setSelectedProject(null)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleUpdateProject} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Nome</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
                    value={selectedProject.name}
                    onChange={(e) => setSelectedProject({...selectedProject, name: e.target.value.toUpperCase()})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Descrição</label>
                  <textarea 
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all min-h-[100px]"
                    value={selectedProject.description || ''}
                    onChange={(e) => setSelectedProject({...selectedProject, description: e.target.value.toUpperCase()})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Status</label>
                  <select 
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
                    value={selectedProject.status}
                    onChange={(e) => setSelectedProject({...selectedProject, status: e.target.value as 'ACTIVE' | 'INACTIVE'})}
                  >
                    <option value="ACTIVE">Ativo</option>
                    <option value="INACTIVE">Inativo</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setSelectedProject(null)}
                    className="flex-1 py-3 bg-neutral-100 text-neutral-700 rounded-xl font-bold hover:bg-neutral-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
