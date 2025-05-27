---
title: "Mathematical Diagrams with TikZ"
date: "2024-01-20"
series: "Mathematics & Life"
tags: ["mathematics", "visualization", "tikz"]
excerpt: "Exploring how mathematical concepts can be beautifully visualized using TikZ diagrams alongside traditional mathematical notation."
---

# Mathematical Diagrams with TikZ

Mathematical concepts often become clearer when we can visualize them. This post demonstrates how we can combine traditional mathematical notation with beautiful TikZ diagrams.

## Basic Geometric Concepts

Let's start with a simple geometric figure. Consider a triangle with labeled vertices:

```tikz
\begin{tikzpicture}
\draw[thick] (0,0) -- (3,0) -- (1.5,2.6) -- cycle;
\node[below] at (0,0) {A};
\node[below] at (3,0) {B};
\node[above] at (1.5,2.6) {C};
\node at (1.5,-0.5) {Triangle ABC};
\end{tikzpicture}
```

This triangle satisfies the fundamental relationship given by the law of cosines:

$$c^2 = a^2 + b^2 - 2ab\cos(C)$$

## Function Visualization

We can also visualize mathematical functions. Here's a simple parabola:

```tikz
\begin{tikzpicture}[scale=0.8]
\draw[->] (-3,0) -- (3,0) node[right] {$x$};
\draw[->] (0,-1) -- (0,4) node[above] {$y$};
\draw[domain=-2.5:2.5,smooth,variable=\x,blue,thick] plot ({\x},{\x*\x/2});
\node[blue] at (2,2.5) {$y = \frac{x^2}{2}$};
\end{tikzpicture}
```

The derivative of this function is simply:

$$\frac{dy}{dx} = x$$

## Set Theory Diagrams

Venn diagrams are perfect for illustrating set theory concepts:

```tikz
\begin{tikzpicture}
\draw[fill=blue!20] (0,0) circle (1.5cm);
\draw[fill=red!20] (2,0) circle (1.5cm);
\node at (-0.7,0) {A};
\node at (2.7,0) {B};
\node at (1,0) {A ∩ B};
\draw (0,0) circle (1.5cm);
\draw (2,0) circle (1.5cm);
\node at (1,-2.5) {$A \cup B$};
\end{tikzpicture}
```

This illustrates the relationship:

$$A \cup B = A + B - A \cap B$$

## Graph Theory

We can visualize graphs and networks:

```tikz
\begin{tikzpicture}
\node[circle,draw,fill=blue!20] (v1) at (0,2) {1};
\node[circle,draw,fill=blue!20] (v2) at (2,2) {2};
\node[circle,draw,fill=blue!20] (v3) at (2,0) {3};
\node[circle,draw,fill=blue!20] (v4) at (0,0) {4};

\draw[thick] (v1) -- (v2);
\draw[thick] (v2) -- (v3);
\draw[thick] (v3) -- (v4);
\draw[thick] (v4) -- (v1);
\draw[thick] (v1) -- (v3);

\node at (1,-1) {Complete Graph $K_4$};
\end{tikzpicture}
```

This graph has exactly $\binom{4}{2} = 6$ edges.

## Complex Analysis

Even complex mathematical concepts become clearer with visualization:

```tikz
\begin{tikzpicture}[scale=0.7]
\draw[->] (-3,0) -- (3,0) node[right] {Re};
\draw[->] (0,-3) -- (0,3) node[above] {Im};

\draw[thick,blue] (0,0) -- (2,1) node[midway,above left] {$z$};
\draw[dashed] (2,0) -- (2,1);
\draw[dashed] (0,1) -- (2,1);

\node[below] at (2,0) {$a$};
\node[left] at (0,1) {$bi$};
\node[above right] at (2,1) {$z = a + bi$};

\draw[red,thick] (0.3,0) arc (0:26.57:0.3);
\node[red] at (0.7,0.2) {$\theta$};
\end{tikzpicture}
```

Where the magnitude is given by:

$$|z| = \sqrt{a^2 + b^2}$$

## Conclusion

Combining mathematical notation with visual diagrams creates a powerful way to communicate mathematical ideas. TikZ provides the precision and beauty needed for academic mathematical writing, while MathJax handles the equations seamlessly.

The integration of these tools in our academic blog allows for rich, interactive mathematical content that engages readers and clarifies complex concepts through both symbolic and visual representations.