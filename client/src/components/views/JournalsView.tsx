import { useState } from "react";
import { useAppStore } from "@/stores/appStore";
import { Card } from "@/components/ui/Card";
import { Trash2, Pencil } from "lucide-react";

export default function JournalsView() {
  const { journals, trades, createJournal, updateJournal, deleteJournal } = useAppStore();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const addEntry = async () => {
    if (!title.trim()) return;
    await createJournal({ title: title.trim(), content: content.trim(), mood: mood || undefined });
    setTitle("");
    setContent("");
    setMood("");
  };

  const startEdit = (entry: any) => {
    setEditingId(entry.id);
    setEditTitle(entry.title);
    setEditContent(entry.content || "");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateJournal(editingId, { title: editTitle, content: editContent });
    setEditingId(null);
  };

  const MOODS = ["Calm", "Confident", "Anxious", "FOMO", "Revenge", "Focused", "Tilted"];

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* New entry */}
      <Card className="p-4">
        <div className="text-xs text-textFaint uppercase tracking-wider mb-3">New journal entry</div>
        <div className="flex flex-col gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (e.g. 'Morning session recap')"
            className="bg-surface2 border border-border rounded-lg px-3 py-2 text-text text-sm"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder="What happened? What did you observe? What would you do differently?"
            className="bg-surface2 border border-border rounded-lg px-3 py-2 text-text text-sm resize-y"
          />
          <div className="flex items-center gap-3">
            <div className="text-xs text-textFaint">Mood:</div>
            <div className="flex gap-1.5 flex-wrap">
              {MOODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMood(mood === m ? "" : m)}
                  className={`text-[11px] px-2.5 py-1 rounded-full transition ${
                    mood === m ? "bg-gold text-[#1A1206] font-bold" : "bg-surface2 text-textDim hover:text-text"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <button onClick={addEntry} className="bg-gold text-[#1A1206] font-bold text-sm px-4 py-2 rounded-lg hover:opacity-90 transition self-start">
            Save Entry
          </button>
        </div>
      </Card>

      {/* Entries list */}
      <Card className="p-4">
        <div className="text-xs text-textFaint uppercase tracking-wider mb-3">Journal ({journals.length})</div>
        {journals.length === 0 ? (
          <div className="text-center py-10 text-textFaint text-sm">No journal entries yet.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {journals.map((entry) => (
              <div key={entry.id} className="bg-surface2 rounded-lg p-3.5">
                {editingId === entry.id ? (
                  <div className="flex flex-col gap-2">
                    <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="bg-surface border border-border rounded px-3 py-1.5 text-text text-sm" />
                    <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={3} className="bg-surface border border-border rounded px-3 py-1.5 text-text text-sm resize-y" />
                    <div className="flex gap-2">
                      <button onClick={saveEdit} className="bg-gold text-[#1A1206] text-xs font-bold px-3 py-1 rounded">Save</button>
                      <button onClick={() => setEditingId(null)} className="text-textDim text-xs hover:text-text">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{entry.title}</div>
                        <div className="text-[11px] text-textFaint mt-0.5">
                          {new Date(entry.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          {entry.mood && <span className="ml-2 text-gold">{entry.mood}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => startEdit(entry)} className="text-textDim hover:text-text transition"><Pencil size={13} /></button>
                        <button onClick={() => deleteJournal(entry.id)} className="text-textDim hover:text-accent-red transition"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    {entry.content && (
                      <div className="text-sm text-textDim mt-2 whitespace-pre-wrap">{entry.content}</div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
