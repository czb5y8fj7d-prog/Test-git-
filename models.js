/* =====================================================================
   models.js — liste de modèles et versions des moteurs (configurable)
   =====================================================================
   Pour ajouter un modèle, copiez une entrée et adaptez-la.

   Champs communs
     id       identifiant interne unique (libre)
     name     nom affiché
     type     'mlc'  → moteur WebGPU (web-llm)
              'gguf' → moteur WASM/CPU (wllama), utilisé si WebGPU est absent
     hf       URL Hugging Face du modèle (affichée comme lien)
     sizeMB   taille de téléchargement estimée (Mo, approximative)
     note     courte description (optionnel)
     default  true → modèle proposé en premier si rien n'est choisi
     maxCtx   contexte maximal supporté par le modèle (défaut 4096)
     noSystem true → fusionne le prompt système dans le 1er message
              utilisateur (modèles sans rôle « system », ex. Gemma)
     thinking false → désactive le mode « réflexion » (Qwen3)

   Champs MLC (type 'mlc')
     mlcId      identifiant dans la liste officielle de web-llm (quantif q4f16_1)
     mlcIdF32   variante q4f32_1, utilisée automatiquement si le navigateur
                n'expose pas « shader-f16 » (null s'il n'en existe pas)
     vramMB     mémoire GPU requise (q4f16_1), indicateur de risque
     vramMBF32  idem pour la variante q4f32_1 (optionnel)
     modelLib   (optionnel) URL d'un .wasm compilé : à renseigner uniquement
                pour un modèle absent de la liste officielle de web-llm

   Champs GGUF (type 'gguf')
     hfRepo     dépôt Hugging Face, ex. 'Qwen/Qwen2.5-0.5B-Instruct-GGUF'
     hfFile     nom du fichier .gguf dans ce dépôt
   ===================================================================== */

/* Moteurs chargés depuis un CDN (versions épinglées).
   Le service worker les met en cache pour l'usage hors ligne. */
export const ENGINES = {
  webllmVersion: '0.2.86',
  wllamaVersion: '3.8.1',
  webllm:     'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.86/+esm',
  wllama:     'https://cdn.jsdelivr.net/npm/@wllama/wllama@3.8.1/esm/index.js',
  wllamaWasm: 'https://cdn.jsdelivr.net/npm/@wllama/wllama@3.8.1/esm/wasm/wllama.wasm',
};

export const MODELS = [
  /* ------------------------- WebGPU (MLC) ------------------------- */
  {
    id: 'qwen25-05b', type: 'mlc',
    name: 'Qwen2.5 0.5B Instruct',
    mlcId: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    mlcIdF32: 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC',
    hf: 'https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    sizeMB: 300, vramMB: 945, vramMBF32: 1060,
    note: 'Minuscule et très rapide, qualité limitée. Idéal pour tester.',
  },
  {
    id: 'llama32-1b', type: 'mlc', default: true,
    name: 'Llama 3.2 1B Instruct',
    mlcId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    mlcIdF32: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
    hf: 'https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC',
    sizeMB: 700, vramMB: 880, vramMBF32: 1130,
    note: 'Bon compromis vitesse / qualité. Recommandé pour démarrer.',
  },
  {
    id: 'gemma3-1b', type: 'mlc', noSystem: true,
    name: 'Gemma 3 1B',
    mlcId: 'gemma3-1b-it-q4f16_1-MLC',
    mlcIdF32: null,
    hf: 'https://huggingface.co/mlc-ai/gemma3-1b-it-q4f16_1-MLC',
    sizeMB: 700, vramMB: 711,
    note: 'Très bon en français pour sa taille. Nécessite shader-f16.',
  },
  {
    id: 'qwen25-15b', type: 'mlc',
    name: 'Qwen2.5 1.5B Instruct',
    mlcId: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    mlcIdF32: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC',
    hf: 'https://huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    sizeMB: 950, vramMB: 1630, vramMBF32: 1890,
    note: 'Multilingue, bon sur le code et le raisonnement simple.',
  },
  {
    id: 'qwen3-17b', type: 'mlc', thinking: false,
    name: 'Qwen3 1.7B',
    mlcId: 'Qwen3-1.7B-q4f16_1-MLC',
    mlcIdF32: 'Qwen3-1.7B-q4f32_1-MLC',
    hf: 'https://huggingface.co/mlc-ai/Qwen3-1.7B-q4f16_1-MLC',
    sizeMB: 1100, vramMB: 2037, vramMBF32: 2635,
    note: 'Génération récente, mode réflexion désactivé par défaut.',
  },
  {
    id: 'smollm2-17b', type: 'mlc',
    name: 'SmolLM2 1.7B Instruct',
    mlcId: 'SmolLM2-1.7B-Instruct-q4f16_1-MLC',
    mlcIdF32: 'SmolLM2-1.7B-Instruct-q4f32_1-MLC',
    hf: 'https://huggingface.co/mlc-ai/SmolLM2-1.7B-Instruct-q4f16_1-MLC',
    sizeMB: 950, vramMB: 1774, vramMBF32: 2692,
    note: 'Entraîné surtout en anglais.',
  },
  {
    id: 'llama32-3b', type: 'mlc',
    name: 'Llama 3.2 3B Instruct',
    mlcId: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    mlcIdF32: 'Llama-3.2-3B-Instruct-q4f32_1-MLC',
    hf: 'https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC',
    sizeMB: 1700, vramMB: 2264, vramMBF32: 2952,
    note: 'Qualité nettement meilleure, mais proche de la limite mémoire de Safari.',
  },
  {
    id: 'qwen25-3b', type: 'mlc',
    name: 'Qwen2.5 3B Instruct',
    mlcId: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
    mlcIdF32: 'Qwen2.5-3B-Instruct-q4f32_1-MLC',
    hf: 'https://huggingface.co/mlc-ai/Qwen2.5-3B-Instruct-q4f16_1-MLC',
    sizeMB: 1700, vramMB: 2505, vramMBF32: 2894,
    note: 'Très bon multilingue. Peut dépasser la mémoire autorisée sur iPhone.',
  },
  {
    id: 'qwen3-4b', type: 'mlc', thinking: false,
    name: 'Qwen3 4B',
    mlcId: 'Qwen3-4B-q4f16_1-MLC',
    mlcIdF32: 'Qwen3-4B-q4f32_1-MLC',
    hf: 'https://huggingface.co/mlc-ai/Qwen3-4B-q4f16_1-MLC',
    sizeMB: 2200, vramMB: 3432, vramMBF32: 4328,
    note: 'Le plus capable de la liste, mais très risqué sur 6 Go de RAM.',
  },

  /* ------------------ WASM / CPU (GGUF, via wllama) ------------------
     Repli sans WebGPU. Nettement plus lent (mono-thread sur GitHub Pages). */
  {
    id: 'gguf-qwen25-05b', type: 'gguf', default: true,
    name: 'Qwen2.5 0.5B Instruct (GGUF Q4_K_M)',
    hfRepo: 'Qwen/Qwen2.5-0.5B-Instruct-GGUF',
    hfFile: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
    hf: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF',
    sizeMB: 490,
    note: 'Le plus léger : recommandé pour le moteur WASM.',
  },
  {
    id: 'gguf-llama32-1b', type: 'gguf',
    name: 'Llama 3.2 1B Instruct (GGUF Q4_K_M)',
    hfRepo: 'bartowski/Llama-3.2-1B-Instruct-GGUF',
    hfFile: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    hf: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF',
    sizeMB: 810,
    note: 'Plus capable, environ 2× plus lent.',
  },
  {
    id: 'gguf-gemma3-1b', type: 'gguf', noSystem: true,
    name: 'Gemma 3 1B (GGUF Q4_K_M)',
    hfRepo: 'ggml-org/gemma-3-1b-it-GGUF',
    hfFile: 'gemma-3-1b-it-Q4_K_M.gguf',
    hf: 'https://huggingface.co/ggml-org/gemma-3-1b-it-GGUF',
    sizeMB: 810,
    note: 'Bon en français.',
  },
  {
    id: 'gguf-qwen25-15b', type: 'gguf',
    name: 'Qwen2.5 1.5B Instruct (GGUF Q4_K_M)',
    hfRepo: 'Qwen/Qwen2.5-1.5B-Instruct-GGUF',
    hfFile: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
    hf: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF',
    sizeMB: 1120,
    note: 'Qualité correcte, lent sur CPU.',
  },
];
