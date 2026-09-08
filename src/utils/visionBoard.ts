/**
 * Ratio largeur/hauteur du canvas d'un vision board — une seule source de
 * vérité, partagée par le rendu (`VisionBoardCanvas`) et par le calcul de
 * taille par défaut d'une image (`useVisionBoards`), qui a besoin de le
 * connaître pour qu'une carte ait le même rapport visuel que la photo
 * qu'elle affiche alors que `x`/`y`/`width`/`height` sont des pourcentages
 * de deux dimensions différentes (largeur du canvas, puis sa hauteur).
 */
export const CANVAS_ASPECT = 16 / 10
