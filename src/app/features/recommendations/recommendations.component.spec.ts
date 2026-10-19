import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { RecommendationsComponent } from './recommendations.component';
import { RecommendationService } from '../../core/services/recommendation.service';
import { CartService } from '../cart/services/cart.service';
import { Recommendation } from '../../core/models/recommendation.model';
import { Product } from '../../core/models/product.model';

describe('RecommendationsComponent', () => {
  let recommendationServiceMock: any;
  let cartServiceMock: any;

  const mockProduct: Product = {
    sku: 'CAM-REC-01',
    name: 'Camiseta Tercera Equipación',
    category: 'Edición Especial',
    price: 45.0,
    stock: 12,
    description: 'Camiseta de colección',
  };

  const mockRecommendation: Recommendation = {
    orderId: 5,
    explanation: 'Basado en tu última compra de camisetas de fútbol',
    recommendations: [
      {
        name: 'Camiseta Tercera Equipación',
        reason: 'Complemento ideal de color alternativo',
        matchedProduct: mockProduct,
      },
    ],
    isFallback: false,
  };

  beforeEach(() => {
    recommendationServiceMock = {
      status: signal<'IDLE' | 'PROCESSING' | 'COMPLETED' | 'UNAVAILABLE'>('COMPLETED'),
      currentRecommendation: signal<Recommendation | null>(mockRecommendation),
      errorMessage: signal<string | null>(null),
      getRecommendationsForOrder: () => of(mockRecommendation),
    };

    cartServiceMock = {
      addToCart: () => {},
    };

    TestBed.configureTestingModule({
      imports: [RecommendationsComponent],
      providers: [
        { provide: RecommendationService, useValue: recommendationServiceMock },
        { provide: CartService, useValue: cartServiceMock },
      ],
    });
  });

  it('debe crearse correctamente y mostrar recomendaciones con Mistral AI', () => {
    const fixture = TestBed.createComponent(RecommendationsComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Mistral AI');
    expect(text).toContain('Recomendaciones para ti');
    expect(text).toContain('Camiseta Tercera Equipación');
    expect(text).toContain('Complemento ideal de color alternativo');
    expect(text).toContain('45.00');
  });

  it('debe permitir añadir la camiseta recomendada al carrito', () => {
    let addedProduct: any = null;
    cartServiceMock.addToCart = (prod: any) => {
      addedProduct = prod;
    };

    const fixture = TestBed.createComponent(RecommendationsComponent);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button.bg-slate-900');
    expect(button).toBeTruthy();
    button.click();

    expect(addedProduct).toEqual(mockProduct);
  });
});

