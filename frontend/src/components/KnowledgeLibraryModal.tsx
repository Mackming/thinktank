import { useState, useEffect } from "react";
import { X, Upload, Trash2, Library, BookOpen } from "lucide-react";

export function KnowledgeLibraryModal({ isOpen, onClose, spaceId, spaceName }: any) {
  const [books, setBooks] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  useEffect(() => {
    if (isOpen && spaceId) {
      fetchBooks();
    }
  }, [isOpen, spaceId]);

  const fetchBooks = async () => {
    try {
      const res = await fetch(`/api/spaces/${spaceId}/books`);
      if (res.ok) {
        const data = await res.json();
        setBooks(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileUpload = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus("Uploading to server...");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name.replace(/\.pdf$/i, ""));

    try {
      const res = await fetch(`/api/spaces/${spaceId}/upload_book`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        setUploadStatus("Processing started (Extracting & Indexing in background)...");
        // Poll for updates a few times
        let attempts = 0;
        const interval = setInterval(() => {
          fetchBooks();
          attempts++;
          if (attempts > 5) {
            clearInterval(interval);
            setIsUploading(false);
            setUploadStatus("");
          }
        }, 3000);
      }
    } catch (e) {
      console.error(e);
      setIsUploading(false);
    }
  };

  const handleDelete = async (bookId: number) => {
    try {
      await fetch(`/api/books/${bookId}`, { method: "DELETE" });
      fetchBooks();
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-3xl flex flex-col max-h-[85vh] overflow-hidden shadow-2xl">
        <div className="flex justify-between items-center p-6 border-b border-white/5 bg-zinc-900/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center border border-white/5">
              <Library className="w-5 h-5 text-zinc-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-100">{spaceName} Library</h2>
              <p className="text-xs text-zinc-400">Core Philosophy & Context</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-white/5 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* Upload Dropzone */}
          <div className="border-2 border-dashed border-zinc-700/50 rounded-xl p-8 flex flex-col items-center justify-center bg-zinc-900/20 hover:bg-zinc-900/40 transition-colors relative">
            <input 
              type="file" 
              accept="application/pdf" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
            <Upload className="w-8 h-8 text-zinc-500 mb-3" />
            <p className="text-sm font-medium text-zinc-300 mb-1">Drag and drop a PDF</p>
            <p className="text-xs text-zinc-500">or click to browse files</p>
          </div>

          {isUploading && (
            <div className="bg-[#050505] border border-white/5 p-4 rounded-lg flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-mono text-zinc-300">{uploadStatus}</span>
            </div>
          )}

          {/* Book List */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">Uploaded Books ({books.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {books.map(book => (
                <div key={book.id} className="bg-zinc-900/50 border border-white/5 p-4 rounded-xl flex items-start gap-4 hover:border-white/10 transition-colors">
                  <div className="mt-1">
                    <BookOpen className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-zinc-200 truncate">{book.title}</h4>
                    <p className="text-xs text-zinc-500 truncate">{book.author || "Unknown Author"}</p>
                  </div>
                  <button onClick={() => handleDelete(book.id)} className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {books.length === 0 && !isUploading && (
                <div className="col-span-full p-8 text-center border border-white/5 rounded-xl border-dashed">
                  <p className="text-sm text-zinc-500">No books uploaded to this space yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
