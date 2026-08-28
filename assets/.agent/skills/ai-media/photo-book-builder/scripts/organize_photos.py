import os
import shutil
import random
import json
import argparse
from PIL import Image

def organize_photos(directory, output_dir, seed=42):
    # Set seed for reproducible/stable randomness
    random.seed(seed)
    
    # 1. Find all jpeg files in the source directory
    all_files = [f for f in os.listdir(directory) if f.lower().endswith(('.jpg', '.jpeg'))]
    all_files.sort() # chronological sort by filename
    
    if not all_files:
        print(f"Error: No JPEG images found in {directory}!")
        return
        
    # 2. Classify by orientation
    landscapes = []
    portraits = []
    
    for f in all_files:
        filepath = os.path.join(directory, f)
        try:
            with Image.open(filepath) as img:
                w, h = img.size
                if w > h:
                    landscapes.append(f)
                else:
                    portraits.append(f)
        except Exception as e:
            print(f"Error reading {f}: {e}")
            
    print(f"Found {len(landscapes)} landscapes and {len(portraits)} portraits.")
    
    # Initialize pages (pages 1 to 20)
    pages = {i: [] for i in range(1, 21)}
    
    # 3. Distribute landscapes
    chunk_size = 20
    for i in range(0, len(landscapes), chunk_size):
        chunk = landscapes[i:i+chunk_size]
        random.shuffle(chunk)
        if len(chunk) == chunk_size:
            for page_idx, filename in enumerate(chunk):
                pages[page_idx + 1].append(filename)
        else:
            chosen_pages = random.sample(range(1, 21), len(chunk))
            for page_num, filename in zip(chosen_pages, chunk):
                pages[page_num].append(filename)
                
    # 4. Distribute portraits
    for i in range(0, len(portraits), chunk_size):
        chunk = portraits[i:i+chunk_size]
        random.shuffle(chunk)
        if len(chunk) == chunk_size:
            for page_idx, filename in enumerate(chunk):
                pages[page_idx + 1].append(filename)
        else:
            chosen_pages = random.sample(range(1, 21), len(chunk))
            for page_num, filename in zip(chosen_pages, chunk):
                pages[page_num].append(filename)
                
    # 5. Verify & Print Proposed Distribution
    print("\n--- Proposed Distribution ---")
    for page_num in range(1, 21):
        files = pages[page_num]
        l_count = sum(1 for f in files if f in landscapes)
        p_count = sum(1 for f in files if f in portraits)
        print(f"Page {page_num}: {len(files)} photos (Landscapes: {l_count}, Portraits: {p_count})")
        
    # Save the mapping as JSON in the output directory
    os.makedirs(output_dir, exist_ok=True)
    mapping_path = os.path.join(output_dir, 'photo_organization_map.json')
    with open(mapping_path, 'w') as f:
        json.dump(pages, f, indent=4)
        
    # Create page folders and move files
    print("\nMoving files into page folders...")
    for page_num, files in pages.items():
        page_dir = os.path.join(output_dir, f"page {page_num}")
        os.makedirs(page_dir, exist_ok=True)
        for filename in files:
            src = os.path.join(directory, filename)
            dst = os.path.join(page_dir, filename)
            shutil.move(src, dst)
            
    print("Organization complete!")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Sort photos chronologically into 20 balanced page folders.")
    parser.add_argument("--dir", default=".", help="Source directory containing unorganized photos.")
    parser.add_argument("--out", default=".", help="Output directory where page folders will be created.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for stable reproducibility.")
    args = parser.parse_args()
    
    organize_photos(args.dir, args.out, args.seed)
