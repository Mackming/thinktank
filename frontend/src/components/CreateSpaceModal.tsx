import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateSpaceModal({ isOpen, onClose, onSpaceCreated }: any) {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setIsSubmitting(true);
    try {
      console.log("DEBUG: Attempting to create space:", name.trim());
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: "", icon: "Library" })
      });
      
      if (res.ok) {
        const newSpace = await res.json();
        onSpaceCreated(newSpace);
        setName("");
        onClose();
      } else {
        const errorText = await res.text();
        window.alert("BACKEND ERROR: " + res.status + " - " + errorText);
      }
    } catch (error: any) {
      console.error(error);
      window.alert("FRONTEND JS ERROR: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-[#0a0a0a] border border-white/10 text-zinc-100">
        <DialogHeader>
          <DialogTitle>Create Knowledge Space</DialogTitle>
          <DialogDescription className="text-zinc-400">
            A dedicated domain to isolate literature and context for your AI mentors.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
          <Input
            autoFocus
            placeholder="e.g. Business Strategy, Stoicism, Fitness"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-[#111] border-white/10 text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-zinc-500"
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting} className="text-zinc-400 hover:text-white hover:bg-white/5">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()} className="bg-white text-black hover:bg-zinc-200">
              {isSubmitting ? "Creating..." : "Create Space"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
