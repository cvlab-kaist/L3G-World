<h1 align="center">L3G-World</h1>
<h3 align="center">Real-Time Infinite World Generation with Latent 3D Gaussian Memory</h3>

<p align="center">
  <a href="https://wlsguur.github.io/">Jinhyeok Choi</a><sup>1,*</sup> ·
  <a href="https://joungbinlee.github.io/">JoungBin Lee</a><sup>1,*</sup> ·
  <a href="https://icetea-cv.github.io/">Jongmin Lee</a><sup>1</sup> ·
  <a href="https://sites.google.com/view/minjeon/home">Minkyeong Jeon</a><sup>1</sup> ·
  <a href="https://rlawldud53.github.io/">Jiyoung Kim</a><sup>1</sup> ·
  <a href="#">Kaeun Han</a><sup>2</sup><br>
  <a href="https://sites.google.com/view/yoonjintrue/home?authuser=0">Yoonjin Yoon</a><sup>1,3,†</sup> ·
  <a href="https://cvlab.kaist.ac.kr/members/faculty">Seungryong Kim</a><sup>1,†</sup>
</p>

<p align="center">
  <sup>1</sup> KAIST AI &nbsp; <sup>2</sup> Ewha Womans University &nbsp; <sup>3</sup> KAIST Urban AI Institute<br>
  <sup>*</sup> Equal contribution &nbsp; <sup>†</sup> Corresponding authors
</p>

<p align="center">
  <a href="https://cvlab-kaist.github.io/L3G-World/"><img src="https://img.shields.io/badge/Project-Page-blue" alt="Project Page"></a>
  <a href="https://arxiv.org/abs/2610.40614"><img src="https://img.shields.io/badge/Paper-arXiv-b31b1b" alt="arXiv"></a>
  <a href="https://arxiv.org/pdf/2610.40614"><img src="https://img.shields.io/badge/Paper-PDF-blue" alt="Paper PDF"></a>
</p>

<p align="center">
  <img src="assets/teaser.png" alt="L3G-World overview: input images, text and cameras initialize latent 3D Gaussian memory; L3G-Mem updates the memory while L3G-Gen generates subsequent video chunks." width="100%">
</p>

**L3G-World couples L3G-Mem and L3G-Gen to generate consistent worlds over long horizons.** Given one image, a text prompt, and a camera trajectory, the L3G-Worls alternates between generating video chunks and updating a persistent **latent 3D Gaussian memory**. Its memory grows with explored scene extent, while direct rendering into the diffusion latent space enables real-time generation with a few-step video model.

_**Check out our [project page](https://cvlab-kaist.github.io/L3G-World/) for more videos and details!**_

## 🌟 Features

- **Adaptive 3D memory.** L3G-Mem spawns Gaussians in newly observed regions and refines existing ones, reducing redundant accumulation and correcting geometric errors.
- **Direct latent rendering.** Each Gaussian stores VAE latents that render directly into the diffusion's latent space, avoiding RGB rendering followed by VAE re-encoding for conditioning L3G-Gen.
- **Consistent world generation.** L3G-World conditions each video chunk on the updated 3D memory autoregressively, for consistent world generation over long horizons.


## 📌 Release Plan

- [ ] L3G-Mem code and model checkpoints.
- [ ] L3G-Gen code and checkpoints.
- [ ] L3G-World inference code.
- [ ] L3G-Gen Fast model checkpoints.

## 🙏 Acknowledgements

We thank the authors and contributors of [Cosmos-Predict2.5](https://github.com/nvidia-cosmos/cosmos-predict2.5) and [ZipSplat](https://github.com/cvg/ZipSplat.git) for their open-source projects.

## ⚖️ License

Our original code is licensed under [MIT](LICENSE). [Cosmos-Predict2.5](https://github.com/nvidia-cosmos/cosmos-predict2.5) and [ZipSplat](https://github.com/cvg/ZipSplat.git)
code retain Apache-2.0. L3G-Mem weights are subject to
[CC BY-NC 4.0](https://huggingface.co/veichta/zipsplat#license) (non-commercial),
while L3G-Gen and L3G-Gen Fast weights follow the
[NVIDIA Open Model License](https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-open-model-license/).
Additional dependency and dataset terms apply; see [NOTICE](NOTICE).

**Built on NVIDIA Cosmos.**

## 📜 Citation

```bibtex
@misc{choi2026l3gworldrealtimeinfiniteworld,
      title={L3G-World: Real-Time Infinite World Generation with Latent 3D Gaussian Memory},
      author={Jinhyeok Choi and JoungBin Lee and Jongmin Lee and Minkyeong Jeon and Jiyoung Kim and Kaeun Han and Yoonjin Yoon and Seungryong Kim},
      year={2026},
      eprint={2610.40614},
      archivePrefix={arXiv},
      primaryClass={cs.CV},
      url={https://arxiv.org/abs/2610.40614},
}
```
