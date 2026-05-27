import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useCurrentUser } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useAdminTestimonials, useCreateTestimonial, useDeleteTestimonial } from "@/hooks/use-admin";
import { Plus, Trash2, Star } from "lucide-react";

export default function AdminTestimonials() {
  const { data: user, isLoading: authLoading } = useCurrentUser();
  const [, setLocation] = useLocation();
  const { data: testimonials, isLoading, refetch } = useAdminTestimonials();
  const { mutate: create } = useCreateTestimonial();
  const { mutate: remove } = useDeleteTestimonial();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", content: "", rating: "5", isPublished: true });

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) setLocation("/admin");
  }, [user, authLoading, setLocation]);

  if (authLoading) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    create({ ...form, rating: parseInt(form.rating) }, { onSuccess: () => { setShowForm(false); refetch(); setForm({ name: "", role: "", content: "", rating: "5", isPublished: true }); } });
  };

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 md:ml-64 p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-display font-bold text-white uppercase tracking-wider">Testimonianze</h1>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-primary text-white px-4 py-2 text-sm font-semibold uppercase tracking-widest hover:bg-primary/80 transition-colors">
            <Plus className="w-4 h-4" /> Aggiungi Recensione
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="bg-card/50 border border-white/10 p-6 mb-8 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground uppercase tracking-widest mb-1">Nome *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="w-full bg-background border border-white/10 text-white px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground uppercase tracking-widest mb-1">Ruolo / Città</label>
                <input value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="w-full bg-background border border-white/10 text-white px-3 py-2 text-sm" placeholder="Barbiere, Milano" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-muted-foreground uppercase tracking-widest mb-1">Recensione *</label>
                <textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} required rows={4} className="w-full bg-background border border-white/10 text-white px-3 py-2 text-sm resize-none" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground uppercase tracking-widest mb-1">Valutazione</label>
                <select value={form.rating} onChange={e => setForm({...form, rating: e.target.value})} className="w-full bg-background border border-white/10 text-white px-3 py-2 text-sm">
                  {[5,4,3,2,1].map(r => <option key={r} value={r}>{r} Stelle</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="bg-primary text-white px-6 py-2 text-sm font-semibold uppercase tracking-widest hover:bg-primary/80 transition-colors">Aggiungi</button>
              <button type="button" onClick={() => setShowForm(false)} className="border border-white/10 text-white px-6 py-2 text-sm">Annulla</button>
            </div>
          </form>
        )}

        {isLoading ? (
          <div className="text-muted-foreground">Caricamento...</div>
        ) : (
          <div className="space-y-4">
            {testimonials?.map((t: any) => (
              <div key={t.id} className="bg-card/30 border border-white/5 p-6 flex gap-6 items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-1 mb-2">
                    {[...Array(t.rating)].map((_, i) => <Star key={i} className="w-3 h-3 fill-yellow-500 text-yellow-500" />)}
                  </div>
                  <p className="text-muted-foreground text-sm mb-3 italic">"{t.content}"</p>
                  <p className="text-white text-sm font-semibold">{t.name}</p>
                  {t.role && <p className="text-muted-foreground text-xs">{t.role}</p>}
                </div>
                <button onClick={() => { if(confirm("Eliminare?")) remove(t.id, { onSuccess: refetch }); }} className="text-red-400 hover:text-red-300">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {(!testimonials || testimonials.length === 0) && (
              <div className="text-center text-muted-foreground py-12 text-sm">Nessuna testimonianza ancora.</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
