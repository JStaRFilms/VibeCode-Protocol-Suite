import os
import json
import argparse
from PIL import Image, ImageDraw

def fit_image(image_path, target_w, target_h):
    with Image.open(image_path) as img:
        img_w, img_h = img.size
        scale = max(target_w / img_w, target_h / img_h)
        new_w = int(img_w * scale)
        new_h = int(img_h * scale)
        resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        left = (new_w - target_w) // 2
        top = (new_h - target_h) // 2
        right = left + target_w
        bottom = top + target_h
        
        return resized.crop((left, top, right, bottom))

def get_page_cells(is_left, count, landscapes, portraits, swap_cols):
    cells = []
    offset = 0 if is_left else 4500
    start_x_offset = 150 if is_left else 75
    
    if count == 5:
        # 4L, 1P -> Template 5A
        # Col 1: width 2550. Col 2: width 1685. Gap 40.
        if not swap_cols:
            col1_x = offset + start_x_offset
            col2_x = offset + start_x_offset + 2550 + 40
        else:
            col2_x = offset + start_x_offset
            col1_x = offset + start_x_offset + 1685 + 40
            
        # Left Col (2550 wide)
        cells.append((landscapes[0], (col1_x, 150, 2550, 1630)))
        cells.append((landscapes[1], (col1_x, 1820, 1255, 1630)))
        cells.append((landscapes[2], (col1_x + 1255 + 40, 1820, 1255, 1630)))
        # Right Col (1685 wide)
        cells.append((portraits[0], (col2_x, 150, 1685, 2480)))
        cells.append((landscapes[3], (col2_x, 2670, 1685, 780)))
        
    elif count == 6 and len(portraits) == 1:
        # 5L, 1P -> Template 6A
        # Col 1: width 2550. Col 2: width 1685. Gap 40.
        if not swap_cols:
            col1_x = offset + start_x_offset
            col2_x = offset + start_x_offset + 2550 + 40
        else:
            col2_x = offset + start_x_offset
            col1_x = offset + start_x_offset + 1685 + 40
            
        # Left Col (2550 wide)
        cells.append((landscapes[0], (col1_x, 150, 1255, 1630)))
        cells.append((landscapes[1], (col1_x + 1255 + 40, 150, 1255, 1630)))
        cells.append((landscapes[2], (col1_x, 1820, 1255, 1630)))
        cells.append((landscapes[3], (col1_x + 1255 + 40, 1820, 1255, 1630)))
        # Right Col (1685 wide)
        cells.append((portraits[0], (col2_x, 150, 1685, 2480)))
        cells.append((landscapes[4], (col2_x, 2670, 1685, 780)))
        
    elif count == 6 and len(portraits) == 2:
        # 4L, 2P -> Template 6B
        # Col 1: width 2118. Col 2: width 2117. Gap 40.
        if not swap_cols:
            col1_x = offset + start_x_offset
            col2_x = offset + start_x_offset + 2118 + 40
        else:
            col2_x = offset + start_x_offset
            col1_x = offset + start_x_offset + 2117 + 40
            
        # Left Col (2118 wide)
        cells.append((landscapes[0], (col1_x, 150, 2118, 1630)))
        cells.append((landscapes[1], (col1_x, 1820, 2118, 1630)))
        # Right Col (2117 wide)
        cells.append((portraits[0], (col2_x, 150, 1038, 1630)))
        cells.append((portraits[1], (col2_x + 1038 + 40, 150, 1038, 1630)))
        cells.append((landscapes[2], (col2_x, 1820, 1038, 1630)))
        cells.append((landscapes[3], (col2_x + 1038 + 40, 1820, 1038, 1630)))
        
    return cells

def generate_layouts(workspace_dir, out_dir, quality=95):
    os.makedirs(out_dir, exist_ok=True)
    
    # Load photo organization mapping
    map_path = os.path.join(workspace_dir, "photo_organization_map.json")
    if not os.path.exists(map_path):
        print(f"Error: Organization map '{map_path}' not found! Run organization step first.")
        return
        
    with open(map_path, "r") as f:
        pages = json.load(f)
        
    canvas_w = 9000
    canvas_h = 3600
    
    for p_str, page_files in pages.items():
        p = int(p_str)
        print(f"Generating optimized full-bleed print spread for Page {p}...")
        
        # Analyze photo orientations on the fly
        orientations = {}
        for filename in page_files:
            img_path = os.path.join(workspace_dir, f"page {p}", filename)
            if not os.path.exists(img_path):
                # Fallback check at root level of workspace
                img_path = os.path.join(workspace_dir, filename)
                
            try:
                with Image.open(img_path) as img:
                    w, h = img.size
                    orientations[filename] = "L" if w > h else "P"
            except Exception as e:
                print(f"Warning: Could not open {filename} to determine orientation: {e}")
                orientations[filename] = "L" # default fallback
                
        l_files = [f for f in page_files if orientations.get(f, "L") == "L"]
        p_files = [f for f in page_files if orientations.get(f, "L") == "P"]
        
        # Determine total photos for layout selection
        total_photos = len(page_files)
        
        # Distribute photos between left and right pages
        if total_photos == 11:
            left_count = 5
            # Left gets 4L, 1P
            left_l = l_files[:4]
            left_p = p_files[:1]
            # Right gets 5L, 1P
            right_l = l_files[4:]
            right_p = p_files[1:]
        elif total_photos == 12:
            left_count = 6
            if len(p_files) >= 3:
                # 9L, 3P distribution
                # Left gets 5L, 1P (Template 6A)
                left_l = l_files[:5]
                left_p = p_files[:1]
                # Right gets 4L, 2P (Template 6B)
                right_l = l_files[5:]
                right_p = p_files[1:]
            else:
                # If we don't have enough portraits for a 6B template on the right,
                # fallback or adapt. Let's assume standard distribution:
                # Left gets 5L, 1P (Template 6A)
                left_l = l_files[:5]
                left_p = p_files[:1] if p_files else []
                # Right gets 4L, 2P (Template 6B) if possible, otherwise adjust counts
                right_l = l_files[5:]
                right_p = p_files[1:] if len(p_files) > 1 else p_files
        else:
            # Fallback for unexpected photo count per page
            print(f"Warning: Page {p} has {total_photos} photos (expected 11 or 12). Making standard splits...")
            left_count = total_photos // 2
            # distribute list evenly
            left_l = l_files[:len(l_files)//2]
            left_p = p_files[:len(p_files)//2]
            right_l = l_files[len(l_files)//2:]
            right_p = p_files[len(p_files)//2:]
            
        left_swap = (p % 2 == 0)
        right_swap = (p % 3 == 0)
        
        left_cells = get_page_cells(is_left=True, count=left_count, landscapes=left_l, portraits=left_p, swap_cols=left_swap)
        right_cells = get_page_cells(is_left=False, count=6, landscapes=right_l, portraits=right_p, swap_cols=right_swap)
        
        # Create canvas with a light background
        canvas = Image.new("RGB", (canvas_w, canvas_h), "#F4F4F6")
        
        # Render Left Page
        for filename, (x, y, w, h) in left_cells:
            img_path = os.path.join(workspace_dir, f"page {p}", filename)
            if not os.path.exists(img_path):
                img_path = os.path.join(workspace_dir, filename)
            try:
                fitted = fit_image(img_path, w, h)
                canvas.paste(fitted, (x, y))
            except Exception as e:
                print(f"Error drawing {filename} on left page {p}: {e}")
                draw = ImageDraw.Draw(canvas)
                draw.rectangle([x, y, x + w, y + h], fill="#CCCCCC")
                
        # Render Right Page
        for filename, (x, y, w, h) in right_cells:
            img_path = os.path.join(workspace_dir, f"page {p}", filename)
            if not os.path.exists(img_path):
                img_path = os.path.join(workspace_dir, filename)
            try:
                fitted = fit_image(img_path, w, h)
                canvas.paste(fitted, (x, y))
            except Exception as e:
                print(f"Error drawing {filename} on right page {p}: {e}")
                draw = ImageDraw.Draw(canvas)
                draw.rectangle([x, y, x + w, y + h], fill="#CCCCCC")
                
        # Save layout spread
        output_path = os.path.join(out_dir, f"page_{p:02d}_layout.jpg")
        canvas.save(output_path, "JPEG", quality=quality)
        print(f"Saved layout to {output_path}")
        
    print("\nAll optimized full-bleed print layouts successfully created!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate full-bleed print spreads for the photo book.")
    parser.add_argument("--workspace-dir", required=True, help="Directory containing page folders and organization map.")
    parser.add_argument("--out-dir", required=True, help="Directory where generated layout spreads should be saved.")
    parser.add_argument("--quality", type=int, default=95, help="JPEG export quality (default: 95).")
    args = parser.parse_args()
    
    generate_layouts(args.workspace_dir, args.out_dir, args.quality)
